import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readJournal } from "../activity/journal.js";
import type { AgentSession } from "./types.js";

/**
 * Les sessions d'agents sur un dépôt, pour l'écran Agents. VisionLayer ne lance aucun agent : il lit ce que
 * chacun consigne déjà. Muse Code tient un index de ses sessions et un journal par session ; Claude Code et
 * Codex passent par les crochets de VisionLayer (`.vision/activity`). On n'en retient que le modèle, la
 * branche, les tokens, les outils de la carte appelés et les chemins des fichiers écrits : jamais un
 * prompt, une commande ou un contenu.
 */
export function agentSessions(root: string): AgentSession[] {
  return [...museSessions(root), ...hookSessions(root)].sort((a, b) => b.started.localeCompare(a.started));
}

const MUSE_INDEX = join(homedir(), ".local", "share", "muse", "session-index.db");
const WRITE_TOOLS = /^(edit_file|write_file|create_file|apply_patch|multi_edit|delete_file)$/;

function real(p: string): string { try { return realpathSync(p); } catch { return p; } }

function museSessions(root: string): AgentSession[] {
  if (!existsSync(MUSE_INDEX)) return [];
  const here = real(root);
  let rows: { session_id: string; workspace_root: string; session_log_path: string; model_id: string | null; git_branch: string | null }[] = [];
  try {
    const db = new DatabaseSync(MUSE_INDEX, { readOnly: true });
    rows = db.prepare("select session_id, workspace_root, session_log_path, model_id, git_branch from sessions where workspace_root is not null").all() as typeof rows;
    db.close();
  } catch { return []; }
  return rows.filter((r) => { const w = real(r.workspace_root); return w === here || w.startsWith(here + sep); })
    .map((r) => readMuseLog(r.session_log_path, here, r))
    .filter((s): s is AgentSession => !!s);
}

function readMuseLog(path: string, root: string, row: { session_id: string; model_id: string | null; git_branch: string | null }): AgentSession | undefined {
  if (!existsSync(path)) return undefined;
  const s: AgentSession = { agent: "muse", id: row.session_id, ...(row.model_id ? { model: row.model_id } : {}), ...(row.git_branch ? { branch: row.git_branch } : {}), started: "", tokens: { input: 0, cached: 0, output: 0, reasoning: 0 }, calls: 0, mapReads: [], writes: [], source: "journal de Muse Code" };
  const writes = new Set<string>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.includes('"payload_type"')) continue;
    let e: any;
    try { e = JSON.parse(line); } catch { continue; }
    const at = typeof e.recorded_at === "number" ? new Date(e.recorded_at / 1000).toISOString() : undefined;
    if (at && !s.started) s.started = at;
    const p = e.payload ?? {};
    if (e.payload_type === "session.workspace_branch.observed" && p.record?.reference?.name) s.branch ??= p.record.reference.name;
    if (e.payload_type === "session.end" && at) s.ended = at;
    const ev = p.event;
    if (!ev) continue;
    if (ev.kind === "model_completed" && ev.usage) {
      s.calls++;
      s.tokens.input += ev.usage.input_tokens ?? 0; s.tokens.cached += ev.usage.cached_tokens ?? 0;
      s.tokens.output += ev.usage.output_tokens ?? 0; s.tokens.reasoning += ev.usage.reasoning_tokens ?? 0;
      if (!s.model && ev.model) s.model = ev.model;
    }
    if (ev.kind === "assistant_tool_calls_committed") {
      for (const c of ev.tool_calls ?? []) {
        const name = String(c.name ?? "");
        if (/vision_/.test(name)) s.mapReads.push({ tool: name.replace(/^mcp__visionlayer__/, ""), beforeFirstWrite: writes.size === 0 });
        if (WRITE_TOOLS.test(name)) {
          let args: any = {};
          try { args = JSON.parse(c.args ?? "{}"); } catch { /* arguments illisibles : aucun chemin retenu */ }
          for (const f of [args.path, args.file_path, ...(String(args.patch ?? args.input ?? "").match(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm) ?? []).map((m: string) => m.replace(/^\*\*\* \w+ File: /, ""))]) {
            if (typeof f !== "string" || !f) continue;
            const rel = relative(root, isAbsolute(f) ? real(f) : join(root, f)).split(sep).join("/");
            if (!rel.startsWith("..") && !/(^|\/)\.env/.test(rel)) writes.add(rel);
          }
        }
      }
    }
  }
  s.writes = [...writes];
  return s.started ? s : undefined;
}

/** Claude Code et Codex : les événements des crochets, regroupés par session. */
function hookSessions(root: string): AgentSession[] {
  const by = new Map<string, AgentSession>();
  for (const e of readJournal(root)) {
    const s = by.get(e.session) ?? by.set(e.session, { agent: e.agent, id: e.session, started: e.at, tokens: { input: 0, cached: 0, output: 0, reasoning: 0 }, calls: 0, mapReads: [], writes: [], source: `crochets de ${e.agent === "claude" ? "Claude Code" : "Codex"}` }).get(e.session)!;
    if (e.model) s.model ??= e.model;
    if (e.tool && /vision_/.test(e.tool)) s.mapReads.push({ tool: e.tool.replace(/^mcp__\w+__/, ""), beforeFirstWrite: s.writes.length === 0 });
    for (const f of e.files ?? []) if (!s.writes.includes(f)) s.writes.push(f);
    if (e.usage) { s.tokens = { input: e.usage.input, cached: e.usage.cacheRead, output: e.usage.output, reasoning: e.usage.reasoning }; s.model ??= e.usage.model; }
    if (e.event === "SessionEnd") s.ended = e.at;
  }
  return [...by.values()];
}
