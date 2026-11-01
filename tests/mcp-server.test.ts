import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { buildModel } from "../vision/model/build.js";
import { writeModel } from "../vision/model/store.js";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");
const ARCH_FIXTURES_DIR = join(import.meta.dirname, "arch-fixtures");
const WORKFLOW_ROOT = join(import.meta.dirname, "..");
const SERVER_ENTRY = join(WORKFLOW_ROOT, "integrations", "agents", "server.ts");
const TSX_BIN = join(WORKFLOW_ROOT, "node_modules", ".bin", "tsx");

/** Copie une fixture dans un dossier temporaire déjà scanné (.vision/model.json présent) — le serveur MCP lit un modèle persisté, comme les CLI, il ne rescanne pas à la volée. */
function preparedFixture(name: string): string {
  const root = mkdtempSync(join(tmpdir(), `vision-mcp-${name}-`));
  cpSync(join(FIXTURES_DIR, name), root, { recursive: true });
  writeModel(root, buildModel(root));
  return root;
}

/** La fixture « shop » (apps, Cloud Functions, Firestore, IA, file) copiée et scannée, pour les outils d'architecture. */
function preparedShop(): string {
  const root = mkdtempSync(join(tmpdir(), "vision-mcp-shop-"));
  cpSync(join(ARCH_FIXTURES_DIR, "shop"), root, { recursive: true });
  writeModel(root, buildModel(root));
  return root;
}

function textContent(result: unknown): string {
  return (result as { content: { type: string; text: string }[] }).content[0]!.text;
}

async function withClient(fn: (client: Client) => Promise<void>): Promise<void> {
  const transport = new StdioClientTransport({ command: TSX_BIN, args: [SERVER_ENTRY] });
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(transport);
  try {
    await fn(client);
  } finally {
    await client.close();
  }
}

function jsonContent(result: unknown): any {
  const content = (result as { content: { type: string; text: string }[] }).content;
  return JSON.parse(content[0]!.text);
}

test("serveur MCP: liste exactement les 4 outils en lecture attendus, tous sur la carte des packs", async () => {
  await withClient(async (client) => {
    const { tools } = await client.listTools();
    assert.deepStrictEqual(
      tools.map((t) => t.name).sort(),
      ["vision_reach", "vision_slice", "vision_source", "vision_summary"],
    );
  });
});

test("serveur MCP: lancé comme dans le README (pnpm --dir), sans root, il lit le dépôt de l'agent, pas VisionLayer", async () => {
  const root = mkdtempSync(join(tmpdir(), "vision-mcp-cwd-"));
  cpSync(join(import.meta.dirname, "corpus", "atelier-api"), root, { recursive: true });
  const transport = new StdioClientTransport({ command: "pnpm", args: ["-s", "--dir", WORKFLOW_ROOT, "mcp"], cwd: root, env: { ...process.env, INIT_CWD: "" } as Record<string, string> });
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(transport);
  try {
    const summary = textContent(await client.callTool({ name: "vision_summary", arguments: {} }));
    assert.ok(summary.startsWith(`SOMMAIRE ${root.split("/").pop()}`), summary.slice(0, 200));
    assert.ok(summary.includes("src/jobs/expire.ts:11"), "les adresses sont relatives au dépôt de l'agent");
  } finally {
    await client.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("serveur MCP: vision_summary puis vision_slice lisent la carte des packs, sans rien écrire dans le dépôt", async () => {
  const root = mkdtempSync(join(tmpdir(), "vision-mcp-atelier-"));
  cpSync(join(import.meta.dirname, "corpus", "atelier-api"), root, { recursive: true });
  try {
    await withClient(async (client) => {
      const summary = textContent(await client.callTool({ name: "vision_summary", arguments: { root } }));
      assert.ok(summary.includes("expireHolds"));
      assert.ok(summary.includes("race_read_then_write@src/jobs/expire.ts:13"));
      const slice = textContent(await client.callTool({ name: "vision_slice", arguments: { root, elements: ["expireHolds"] } }));
      assert.ok(slice.includes("src/bookings/confirm.ts:28"), slice);
      assert.ok(slice.includes("status = confirmed"), slice);
    });
    assert.ok(!existsSync(join(root, ".vision")), "le serveur ne doit rien écrire dans le dépôt");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("serveur MCP: vision_source dit où un nom est déclaré, méthode de classe comprise, et qui l'appelle", async () => {
  const root = mkdtempSync(join(tmpdir(), "vision-mcp-source-"));
  cpSync(join(import.meta.dirname, "corpus", "atelier-api"), root, { recursive: true });
  try {
    await withClient(async (client) => {
      const fn = textContent(await client.callTool({ name: "vision_source", arguments: { root, name: "requireUser" } }));
      assert.match(fn, /déclaré : function requireUser  src\/auth\/session\.ts:21-/);
      assert.match(fn, /src\/bookings\/get\.ts:9  requireUser\(…\)/);
      const method = textContent(await client.callTool({ name: "vision_source", arguments: { root, name: "SmtpSender.send" } }));
      assert.match(method, /déclaré : method SmtpSender\.send  src\/email\/smtp\.ts:12-/);
      assert.doesNotMatch(method, /ResendSender/);
      const none = textContent(await client.callTool({ name: "vision_source", arguments: { root, name: "nothingLikeThis" } }));
      assert.match(none, /aucune déclaration de ce nom/);
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("serveur MCP: n'expose aucun outil d'écriture (update/diff/report)", async () => {
  await withClient(async (client) => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    for (const forbidden of ["vision_update", "vision_diff", "vision_report"]) {
      assert.ok(!names.includes(forbidden), `${forbidden} ne doit jamais être exposé à un agent (MVP5, gouvernance AI RMF)`);
    }
  });
});

