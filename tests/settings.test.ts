import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SettingsSource } from "../vision/web/settings-source.js";

const files = (dir: string) => ["AGENTS.md", "CLAUDE.md", ".mcp.json", ".claude/settings.json"].map((f) => existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : null);

test("réglages : relier puis délier rend les fichiers des agents à l'octet près", () => {
  const dir = mkdtempSync(join(tmpdir(), "vl-links-"));
  mkdirSync(join(dir, ".claude"));
  writeFileSync(join(dir, "AGENTS.md"), "# Rules\n\nBe nice.\n");
  writeFileSync(join(dir, ".mcp.json"), '{"mcpServers":{"other":{"command":"x"}}}');
  writeFileSync(join(dir, ".claude", "settings.json"), '{"model":"opus"}');
  const before = files(dir);
  const s = new SettingsSource(dir);
  s.link("muse"); s.link("claude");
  const linked = s.get();
  assert.ok(linked.find((a) => a.agent === "claude")!.report.linked && linked.every((a) => a.agent === "codex" || a.map.linked));
  // Le serveur MCP est partagé : délier Claude Code le laisse à Muse Code.
  s.unlink("claude");
  assert.equal(s.get().find((a) => a.agent === "muse")!.map.linked, true);
  s.unlink("muse");
  assert.deepEqual(files(dir), before);
  assert.equal(existsSync(join(dir, ".vision")), false);
});

test("réglages : sur un projet sans aucun fichier d'agent, délier ne laisse rien", () => {
  const dir = mkdtempSync(join(tmpdir(), "vl-links-"));
  const s = new SettingsSource(dir);
  s.link("claude"); s.unlink("claude");
  assert.deepEqual(readdirSync(dir), []);
});
