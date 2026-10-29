import { existsSync, readFileSync } from "node:fs";
import type { AgentKind, TokenUsage } from "./journal.js";

/**
 * Compteurs de tokens d'une session, lus dans le transcript LOCAL de l'agent.
 * Seuls les compteurs sont lus : le contenu des messages n'est ni copié ni
 * interprété.
 *
 * - Claude Code : chaque réponse (`type: "assistant"`) porte `message.usage` ;
 *   une même réponse peut s'étaler sur plusieurs lignes avec le même
 *   `message.id` → comptée une fois.
 * - Codex : les événements `token_count` portent le cumul de la session
 *   (`info.total_token_usage`) → on garde le dernier ; le modèle vient de
 *   `turn_context.payload.model`.
 */
export function readUsage(agent: AgentKind, transcriptPath: string): TokenUsage | undefined {
  if (!existsSync(transcriptPath)) return undefined;
  const content = readFileSync(transcriptPath, "utf-8");
  return agent === "claude" ? claudeUsage(content) : codexUsage(content);
}

function empty(): TokenUsage {
  return { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0, byModel: {} };
}

function add(u: TokenUsage, model: string, x: { input: number; cacheRead: number; cacheWrite: number; output: number; reasoning: number }): void {
  u.input += x.input;
  u.cacheRead += x.cacheRead;
  u.cacheWrite += x.cacheWrite;
  u.output += x.output;
  u.reasoning += x.reasoning;
  const m = (u.byModel[model] ??= { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 });
  m.input += x.input;
  m.cacheRead += x.cacheRead;
  m.cacheWrite += x.cacheWrite;
  m.output += x.output;
  m.reasoning += x.reasoning;
}

function mainModel(u: TokenUsage): string | undefined {
  const total = (m: Omit<TokenUsage, "model" | "byModel">) => m.input + m.cacheRead + m.cacheWrite + m.output;
  return Object.entries(u.byModel).sort((a, b) => total(b[1]) - total(a[1]))[0]?.[0];
}

function claudeUsage(content: string): TokenUsage | undefined {
  const u = empty();
  const seen = new Set<string>();
  let found = false;
  for (const line of content.split("\n")) {
    if (!line.includes('"usage"')) continue; // la plupart des lignes n'ont pas de compteurs : pas de JSON.parse inutile
    let d: any;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    const m = d?.message;
    if (d?.type !== "assistant" || !m?.usage) continue;
    const key = m.id ?? d.uuid;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    const x = m.usage;
    add(u, m.model ?? "inconnu", {
      input: x.input_tokens ?? 0,
      cacheRead: x.cache_read_input_tokens ?? 0,
      cacheWrite: x.cache_creation_input_tokens ?? 0,
      output: x.output_tokens ?? 0,
      reasoning: x.output_tokens_details?.thinking_tokens ?? 0,
    });
    found = true;
  }
  if (!found) return undefined;
  u.model = mainModel(u);
  return u;
}

function codexUsage(content: string): TokenUsage | undefined {
  let total: any;
  let model = "inconnu";
  for (const line of content.split("\n")) {
    if (!line.includes('"token_count"') && !line.includes('"turn_context"')) continue;
    let d: any;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    if (d?.type === "turn_context" && d.payload?.model) model = d.payload.model;
    if (d?.payload?.type === "token_count" && d.payload.info?.total_token_usage) total = d.payload.info.total_token_usage;
  }
  if (!total) return undefined;
  const u = empty();
  const cached = total.cached_input_tokens ?? 0;
  // Chez Codex, input_tokens INCLUT les tokens servis par le cache.
  add(u, model, {
    input: Math.max(0, (total.input_tokens ?? 0) - cached),
    cacheRead: cached,
    cacheWrite: total.cache_write_input_tokens ?? 0,
    output: total.output_tokens ?? 0,
    reasoning: total.reasoning_output_tokens ?? 0,
  });
  u.model = model;
  return u;
}
