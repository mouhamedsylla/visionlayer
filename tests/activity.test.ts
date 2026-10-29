import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { buildModel } from "../vision/model/build.js";
import { writeModel } from "../vision/model/store.js";
import { buildInfraModel } from "../vision/infra/build.js";
import { buildArchModel } from "../vision/arch/build.js";
import { eventFromHook } from "../vision/activity/hook.js";
import { appendEvent, readJournal } from "../vision/activity/journal.js";
import { readUsage } from "../vision/activity/usage.js";
import { buildCostReport, costOf } from "../vision/activity/cost.js";
import { formatCostReport } from "../vision/activity/format.js";

const SHOP = join(import.meta.dirname, "arch-fixtures", "shop");
const WORKFLOW_ROOT = join(import.meta.dirname, "..");
const TSX_BIN = join(WORKFLOW_ROOT, "node_modules", ".bin", "tsx");

function scannedShop(): string {
  const root = mkdtempSync(join(tmpdir(), "vision-activity-"));
  cpSync(SHOP, root, { recursive: true });
  writeModel(root, buildModel(root));
  return root;
}

/** Transcript Claude Code : une réponse étalée sur deux lignes (même message.id) comptée une fois, plus une seconde réponse. */
function claudeTranscript(dir: string): string {
  const path = join(dir, "claude.jsonl");
  const line = (id: string, usage: object) => JSON.stringify({ type: "assistant", uuid: `u-${id}-${Math.random()}`, message: { id, model: "claude-opus-5-5", usage, content: [{ type: "text", text: "secret du prompt" }] } });
  writeFileSync(
    path,
    [
      JSON.stringify({ type: "user", message: { role: "user", content: "mon prompt confidentiel" } }),
      line("m1", { input_tokens: 10, cache_read_input_tokens: 1000, cache_creation_input_tokens: 200, output_tokens: 50 }),
      line("m1", { input_tokens: 10, cache_read_input_tokens: 1000, cache_creation_input_tokens: 200, output_tokens: 50 }),
      line("m2", { input_tokens: 5, cache_read_input_tokens: 2000, cache_creation_input_tokens: 0, output_tokens: 100, output_tokens_details: { thinking_tokens: 40 } }),
    ].join("\n") + "\n",
  );
  return path;
}

/** Fichier de session Codex : le dernier cumul `token_count` fait foi ; input_tokens y inclut le cache. */
function codexRollout(dir: string): string {
  const path = join(dir, "rollout.jsonl");
  const count = (input: number, cached: number, output: number) =>
    JSON.stringify({ type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: output, reasoning_output_tokens: 7, total_tokens: input + output } } } });
  writeFileSync(path, [JSON.stringify({ type: "turn_context", payload: { model: "gpt-5.6-terra" } }), count(500, 300, 20), count(3000, 2000, 90)].join("\n") + "\n");
  return path;
}

test("compteurs de tokens : Claude dédoublonné par message, Codex au dernier cumul", () => {
  const dir = mkdtempSync(join(tmpdir(), "vision-usage-"));
  try {
    const c = readUsage("claude", claudeTranscript(dir))!;
    assert.deepStrictEqual([c.input, c.cacheRead, c.cacheWrite, c.output, c.reasoning], [15, 3000, 200, 150, 40]);
    assert.equal(c.model, "claude-opus-5-5");
    const x = readUsage("codex", codexRollout(dir))!;
    assert.deepStrictEqual([x.input, x.cacheRead, x.output], [1000, 2000, 90]);
    assert.equal(x.model, "gpt-5.6-terra");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hook : ne garde que l'événement, l'outil et les chemins du repository — jamais un prompt, une commande ou un .env", () => {
  const root = scannedShop();
  try {
    const base = { session_id: "s1", cwd: join(root, "functions"), transcript_path: "/tmp/t.jsonl" };
    assert.equal(eventFromHook("claude", { ...base, hook_event_name: "UserPromptSubmit", prompt: "mon secret" }), undefined);
    assert.equal(eventFromHook("claude", { ...base, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "curl -H 'token: abc'" } }), undefined);
    const edit = eventFromHook("claude", { ...base, hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: { file_path: join(root, "functions/src/ai.ts"), old_string: "a", new_string: "b" } })!;
    assert.equal(edit.root, root);
    assert.deepStrictEqual(edit.event.files, ["functions/src/ai.ts"]);
    assert.ok(!JSON.stringify(edit.event).includes("new_string"));
    const outside = eventFromHook("claude", { ...base, hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: "/etc/hosts" } });
    assert.equal(outside, undefined, "un chemin hors du repository n'est pas consigné");
    const env = eventFromHook("claude", { ...base, hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: join(root, ".env.local") } });
    assert.equal(env, undefined);
    const patch = eventFromHook("codex", { ...base, cwd: root, hook_event_name: "PostToolUse", tool_name: "apply_patch", tool_input: { input: "*** Begin Patch\n*** Update File: functions/src/index.ts\n@@\n-x\n+y\n*** End Patch" } })!;
    assert.deepStrictEqual(patch.event.files, ["functions/src/index.ts"]);
    const read = eventFromHook("claude", { ...base, hook_event_name: "PostToolUse", tool_name: "mcp__visionlayer__vision_flow", tool_input: { feature: "placeOrder" } })!;
    assert.equal(read.event.tool, "mcp__visionlayer__vision_flow");
    assert.equal(eventFromHook("claude", { ...base, cwd: tmpdir(), hook_event_name: "SessionStart" }), undefined, "hors d'un projet scanné : rien");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("coût par feature : une session répartie entre les features dont elle a modifié le code", () => {
  const root = scannedShop();
  try {
    const arch = buildArchModel(root, buildModel(root), buildInfraModel(root));
    const place = arch.entries.find((e) => e.name === "placeOrder")!;
    assert.deepStrictEqual(place.files, ["functions/src/ai.ts", "functions/src/db.ts", "functions/src/index.ts"]);
    const claude = claudeTranscript(root);
    const codex = codexRollout(root);
    const ev = (agent: "claude" | "codex", session: string, at: string, rest: object) => ({ agent, session, at, ...rest }) as any;
    const events = [
      ev("claude", "A", "2026-09-27T10:00:00Z", { event: "PostToolUse", tool: "mcp__visionlayer__vision_flow" }),
      ev("claude", "A", "2026-09-27T10:01:00Z", { event: "PostToolUse", tool: "Edit", files: ["functions/src/ai.ts"] }),
      ev("claude", "A", "2026-09-27T10:02:00Z", { event: "PostToolUse", tool: "Edit", files: ["src/pages/Checkout.tsx"] }),
      ev("claude", "A", "2026-09-27T10:03:00Z", { event: "Stop", transcript: claude }),
      ev("codex", "B", "2026-09-27T11:00:00Z", { event: "PostToolUse", tool: "apply_patch", files: ["functions/src/index.ts"] }),
      ev("codex", "B", "2026-09-27T11:05:00Z", { event: "Stop", transcript: codex }),
      ev("claude", "C", "2026-09-27T12:00:00Z", { event: "PostToolUse", tool: "mcp__visionlayer__vision_architecture" }),
    ];
    const r = buildCostReport(arch, events);
    const a = r.sessions.find((s) => s.session === "A")!;
    assert.equal(a.tokens, 15 + 3000 + 200 + 150);
    assert.equal(a.mapReadBeforeFirstEdit, true);
    const t = (name: string) => r.targets.find((x) => x.name === name);
    // Session A : 2 fichiers → ai.ts (placeOrder seul) = 1/2, Checkout.tsx (aucune feature serveur → le bloc de l'app) = 1/2.
    // Session B : index.ts, exécuté par placeOrder, unusedAdmin et onOrderCreated → 1/3 chacun.
    assert.equal(t("placeOrder")!.tokens, a.tokens / 2 + 3090 / 3);
    assert.equal(t("unusedAdmin")!.tokens, 3090 / 3);
    assert.equal(t("onOrderCreated")!.tokens, 3090 / 3);
    const app = r.targets.find((x) => x.kind === "block")!;
    assert.equal(app.tokens, a.tokens / 2);
    assert.deepStrictEqual(r.unattributed.map((s) => s.session), ["C"]);
    assert.equal(r.priced, false);
    assert.match(formatCostReport(r), /placeOrder/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("tarifs : seulement déclarés, jamais inventés ; un modèle sans tarif ne donne pas de montant", () => {
  const usage = { input: 1_000_000, cacheRead: 1_000_000, cacheWrite: 0, output: 1_000_000, reasoning: 0, byModel: { "claude-opus-5-5": { input: 1_000_000, cacheRead: 1_000_000, cacheWrite: 0, output: 1_000_000, reasoning: 0 } } };
  assert.equal(costOf(usage, undefined), undefined);
  assert.equal(costOf(usage, { currency: "USD", perMillion: { "claude-opus": { input: 5, output: 25, cacheRead: 0.5 } } }), 30.5);
  assert.equal(costOf(usage, { currency: "USD", perMillion: { "gpt-5": { input: 1, output: 2 } } }), undefined);
});

test("vision hook : lit stdin, écrit le journal (qui s'ignore dans git), ne bloque jamais l'agent", () => {
  const root = scannedShop();
  try {
    const run = (input: string) => execFileSync(TSX_BIN, [join(WORKFLOW_ROOT, "cli", "hook.ts"), "claude"], { input, encoding: "utf-8" });
    assert.equal(run("pas du json"), "");
    assert.equal(run(JSON.stringify({ hook_event_name: "PostToolUse", session_id: "s", cwd: root, tool_name: "Write", tool_input: { file_path: "functions/src/db.ts" } })), "");
    assert.deepStrictEqual(readJournal(root).map((e) => e.files), [["functions/src/db.ts"]]);
    assert.equal(readFileSync(join(root, ".vision", "activity", ".gitignore"), "utf-8"), "*\n");
    appendEvent(root, { at: "x", agent: "codex", session: "t", event: "Stop" });
    assert.equal(readJournal(root).length, 2);
    assert.ok(existsSync(join(root, ".vision", "activity", "journal.jsonl")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
