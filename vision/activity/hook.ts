import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { ActivityEvent, AgentKind } from "./journal.js";
import { readUsage } from "./usage.js";

/**
 * Transforme l'entrée JSON d'un hook (Claude Code ou Codex : mêmes champs
 * communs `session_id`, `transcript_path`, `cwd`, `hook_event_name`,
 * `tool_name`, `tool_input`) en événement de journal.
 *
 * Retenu : l'événement, le nom de l'outil, les CHEMINS des fichiers modifiés
 * dans le repository. Jamais retenu : `prompt`, la commande d'un Bash, le
 * contenu écrit, un chemin hors du repository.
 */

/** Événements utiles : début et fin de session, fin de tour (compteurs), appels d'outils. */
const KEPT = new Set(["SessionStart", "PostToolUse", "Stop", "SubagentStop", "SessionEnd"]);

/** Clés de `tool_input` qui désignent un fichier écrit, selon l'outil. */
const PATH_KEYS = ["file_path", "path", "notebook_path"];

export interface HookOutcome {
  root: string;
  event: ActivityEvent;
}

export function eventFromHook(agent: AgentKind, raw: unknown, now = new Date()): HookOutcome | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const h = raw as Record<string, any>;
  const name = String(h.hook_event_name ?? "");
  if (!KEPT.has(name)) return undefined;
  const cwd = typeof h.cwd === "string" ? h.cwd : process.cwd();
  const root = repoRoot(cwd);
  if (!root) return undefined; // pas un projet scanné par VisionLayer : rien à consigner
  const event: ActivityEvent = {
    at: now.toISOString(),
    agent,
    session: String(h.session_id ?? "inconnue"),
    event: name,
  };
  if (typeof h.transcript_path === "string") event.transcript = h.transcript_path;
  if (typeof h.model === "string") event.model = h.model;
  if (name === "PostToolUse" && typeof h.tool_name === "string") {
    event.tool = h.tool_name;
    const files = writtenFiles(h.tool_name, h.tool_input, cwd, root);
    if (files.length) event.files = files;
    // Un appel d'outil qui n'écrit rien et n'est pas une lecture de la carte : bruit, pas consigné.
    if (!files.length && !/vision_/.test(h.tool_name)) return undefined;
  }
  if ((name === "Stop" || name === "SessionEnd" || name === "SubagentStop") && event.transcript) {
    const usage = readUsage(agent, event.transcript);
    if (usage) event.usage = usage;
  }
  return { root, event };
}

/** Le repository qui contient `cwd` et a déjà été scanné (`.vision/model.json`). */
export function repoRoot(cwd: string): string | undefined {
  let dir = resolve(cwd);
  for (;;) {
    if (existsSync(join(dir, ".vision", "model.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function writtenFiles(tool: string, input: unknown, cwd: string, root: string): string[] {
  if (!input || typeof input !== "object") return [];
  // Les outils de lecture et le shell ne sont pas des écritures : leur chemin n'est pas retenu.
  if (/^(Read|Glob|Grep|LS|Bash|shell|exec_command|WebFetch|WebSearch)$/i.test(tool)) return [];
  const found = new Set<string>();
  const inside = (p: string) => {
    const abs = isAbsolute(p) ? p : resolve(cwd, p);
    const rel = relative(root, abs);
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) return; // jamais un chemin hors du repository
    const norm = rel.split(sep).join("/");
    if (/(^|\/)\.env/.test(norm)) return; // ni même le nom d'un .env modifié ne sert au coût
    found.add(norm);
  };
  const visit = (v: unknown, key?: string) => {
    if (typeof v === "string") {
      if (key && PATH_KEYS.includes(key)) inside(v);
      // Patch au format Codex (apply_patch) : seules les lignes d'en-tête de fichier sont lues.
      for (const m of v.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)) inside(m[1]!.trim());
      for (const m of v.matchAll(/^\*\*\* Move to: (.+)$/gm)) inside(m[1]!.trim());
    } else if (Array.isArray(v)) v.forEach((x) => visit(x, key));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) visit(x, k);
  };
  visit(input);
  return [...found].sort();
}
