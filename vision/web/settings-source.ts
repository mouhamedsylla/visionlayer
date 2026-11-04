import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import type { AgentLink } from "./types.js";

/**
 * Les Réglages des agents (planche 40) : pour chaque agent de code, ce qui le relie à VisionLayer dans ce
 * projet, et les deux gestes humains qui posent ou retirent ces liens. On n'écrit que dans les fichiers de
 * réglage des agents (`.mcp.json`, `.claude/settings.json`, la section VisionLayer d'AGENTS.md ou CLAUDE.md),
 * jamais dans le code du projet ; délier remet ces fichiers exactement comme avant.
 */

const VL = join(import.meta.dirname, "..", "..");
const SERVER = { command: "pnpm", args: ["-s", "--dir", VL, "mcp"] };
const HOOK = `pnpm -s --dir ${JSON.stringify(VL)} hook claude`;
const HOOK_EVENTS = ["SessionStart", "PostToolUse", "Stop", "SessionEnd"];
const START = "<!-- visionlayer:start -->", END = "<!-- visionlayer:end -->";

/** Le contrat donné aux agents : lire la carte avant, déclarer après. Les mêmes règles qu'aux essais du 31/10. */
export const CONTRACT = `${START}
## VisionLayer

VisionLayer has already read this system: its programs, entry points, guards, tables, queues, external services and known findings. Use it instead of exploring the code.

1. Call \`vision_summary\` first. It lists the system one line per element.
2. Choose every element your task concerns and call \`vision_slice\` with their names. It gives the file:line of each relevant piece of code and what it reads, writes and calls.
3. Read the file:line addresses the slice gives. To find where a symbol is declared and who calls it, call \`vision_source\`. Do not run broad searches to orient yourself.
4. After changing code and before concluding, call \`vision_reach\`, and say for each finding it gives whether your change touches or worsens it.
5. Before concluding, write what the code does not say in a YAML file under \`.vision/knowledge/\`, anchored on the code. Only this format is read:

\`\`\`yaml
concept: order-confirmation
kind: feature
name: Order confirmation
claims:
  - id: order-confirmation.once
    type: rule        # rule, invariant, decision, guarantee, limit or failure
    text: An order is confirmed at most once.
    anchor: src/orders/confirm.ts#confirmOrder
\`\`\`
${END}`;

function onPath(bin: string): boolean {
  const dirs = [...(process.env.PATH ?? "").split(delimiter), join(homedir(), ".local", "bin")];
  return dirs.some((d) => d && existsSync(join(d, bin)));
}

function readJson(path: string): any { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return undefined; } }
function writeJson(path: string, v: unknown) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(v, null, 2) + "\n"); }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isOurs = (s: any) => s && Array.isArray(s.args) && s.args.includes("mcp") && s.args.some((a: string) => /visionlayer/.test(a));
const hasContract = (path: string) => existsSync(path) && readFileSync(path, "utf8").includes(START);

export class SettingsSource {
  constructor(private readonly root: string) {}

  private get mcpFile() { return join(this.root, ".mcp.json"); }
  private get claudeSettings() { return join(this.root, ".claude", "settings.json"); }

  /** Le texte d'un fichier de réglage avant le premier lien, pour le rendre tel quel au déliement. */
  private get backups() { return join(this.root, ".vision", "links.json"); }
  private state(): { files: Record<string, string | null>; mcp: string[] } { const b = readJson(this.backups); return { files: b?.files ?? {}, mcp: b?.mcp ?? [] }; }
  private save(st: { files: Record<string, string | null>; mcp: string[] }) {
    if (Object.keys(st.files).length || st.mcp.length) writeJson(this.backups, st);
    else { rmFile(this.backups); rmEmpty(join(this.root, ".vision")); }
  }
  private keep(path: string) {
    const st = this.state();
    const key = path.slice(this.root.length + 1);
    if (key in st.files) return;
    st.files[key] = existsSync(path) ? readFileSync(path, "utf8") : null;
    this.save(st);
  }
  /** Écrire l'objet allégé ; s'il redevient celui d'avant le lien, remettre le texte d'origine, ou retirer le fichier. */
  private restore(path: string, v: any) {
    const st = this.state();
    const key = path.slice(this.root.length + 1);
    const orig = st.files[key];
    if (typeof orig === "string" && same(safeParse(orig), v)) writeFileSync(path, orig);
    else if (Object.keys(v).length) writeJson(path, v);
    else { rmFile(path); rmEmpty(dirname(path)); }
    delete st.files[key];
    this.save(st);
  }

  private mcpLinked(): boolean { return Object.values(readJson(this.mcpFile)?.mcpServers ?? {}).some(isOurs); }
  private hooksLinked(): boolean { return JSON.stringify(readJson(this.claudeSettings)?.hooks ?? {}).includes(" hook claude"); }
  private codexMcp(): boolean { const f = join(homedir(), ".codex", "config.toml"); return existsSync(f) && /\[mcp_servers\.visionlayer\]/.test(readFileSync(f, "utf8")); }

  get(): AgentLink[] {
    return [
      { agent: "muse", installed: onPath("muse"),
        map: { linked: this.mcpLinked(), where: ".mcp.json", editable: true },
        report: { linked: true, where: "son journal local, lu tel quel", editable: false },
        contract: { linked: hasContract(join(this.root, "AGENTS.md")), where: "AGENTS.md", editable: true } },
      { agent: "claude", installed: onPath("claude"),
        map: { linked: this.mcpLinked(), where: ".mcp.json", editable: true },
        report: { linked: this.hooksLinked(), where: ".claude/settings.json", editable: true },
        contract: { linked: hasContract(join(this.root, "CLAUDE.md")), where: "CLAUDE.md", editable: true } },
      { agent: "codex", installed: onPath("codex"),
        map: { linked: this.codexMcp(), where: "~/.codex/config.toml, réglage de la machine", editable: false },
        report: { linked: false, where: "crochets de Codex, à poser à la main", editable: false },
        contract: { linked: hasContract(join(this.root, "AGENTS.md")), where: "AGENTS.md, partagé avec Muse Code", editable: true } },
    ];
  }

  /** Relier : le serveur MCP, les crochets (Claude Code), la section du contrat. Rien d'autre n'est touché. */
  link(agent: string): AgentLink[] {
    if (agent !== "codex") {
      this.keep(this.mcpFile);
      const st = this.state();
      if (!st.mcp.includes(agent)) { st.mcp.push(agent); this.save(st); }
      const mcp = readJson(this.mcpFile) ?? {};
      mcp.mcpServers = { ...(mcp.mcpServers ?? {}), visionlayer: SERVER };
      writeJson(this.mcpFile, mcp);
    }
    if (agent === "claude") {
      this.keep(this.claudeSettings);
      const s = readJson(this.claudeSettings) ?? {};
      s.hooks ??= {};
      for (const ev of HOOK_EVENTS) {
        const list = (s.hooks[ev] ??= []);
        if (!JSON.stringify(list).includes(" hook claude")) list.push({ hooks: [{ type: "command", command: HOOK }] });
      }
      writeJson(this.claudeSettings, s);
    }
    const file = join(this.root, agent === "claude" ? "CLAUDE.md" : "AGENTS.md");
    if (!hasContract(file)) {
      const before = existsSync(file) ? readFileSync(file, "utf8") : "";
      writeFileSync(file, `${before}${before && !before.endsWith("\n") ? "\n" : ""}${before ? "\n" : ""}${CONTRACT}\n`);
    }
    return this.get();
  }

  /** Délier : retirer exactement ce que relier a posé, et les fichiers devenus vides. */
  unlink(agent: string): AgentLink[] {
    const st = this.state();
    const holders = st.mcp.filter((a) => a !== agent);
    if (agent !== "codex" && st.mcp.includes(agent)) { st.mcp = holders; this.save(st); }
    if (agent !== "codex" && !holders.length) {
      const mcp = readJson(this.mcpFile);
      if (mcp?.mcpServers?.visionlayer) {
        delete mcp.mcpServers.visionlayer;
        if (!Object.keys(mcp.mcpServers).length) delete mcp.mcpServers;
        this.restore(this.mcpFile, mcp);
      }
    }
    if (agent === "claude") {
      const s = readJson(this.claudeSettings);
      if (s?.hooks) {
        for (const ev of Object.keys(s.hooks)) {
          s.hooks[ev] = s.hooks[ev].filter((h: any) => !JSON.stringify(h).includes(" hook claude"));
          if (!s.hooks[ev].length) delete s.hooks[ev];
        }
        if (!Object.keys(s.hooks).length) delete s.hooks;
        this.restore(this.claudeSettings, s);
      }
    }
    // AGENTS.md sert à Muse Code et à Codex : délier l'un retire la section pour les deux, l'écran le dit.
    const file = join(this.root, agent === "claude" ? "CLAUDE.md" : "AGENTS.md");
    if (hasContract(file)) {
      const text = readFileSync(file, "utf8");
      const out = text.slice(0, text.indexOf(START)).replace(/\n+$/, "") + text.slice(text.indexOf(END) + END.length).replace(/^\n+/, "\n");
      out.trim() ? writeFileSync(file, out.endsWith("\n") ? out : out + "\n") : rmFile(file);
    }
    return this.get();
  }
}

function rmFile(path: string) { rmSync(path, { force: true }); }
function rmEmpty(dir: string) { try { if (existsSync(dir) && !readdirSync(dir).length) rmdirSync(dir); } catch { /* laissé tel quel */ } }
function safeParse(t: string): unknown { try { return JSON.parse(t); } catch { return undefined; } }
