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

test("serveur MCP: liste exactement les 8 outils en lecture attendus", async () => {
  await withClient(async (client) => {
    const { tools } = await client.listTools();
    assert.deepStrictEqual(
      tools.map((t) => t.name).sort(),
      ["vision_architecture", "vision_context", "vision_flow", "vision_inspect", "vision_reach", "vision_slice", "vision_source", "vision_summary"],
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

test("serveur MCP: vision_context renvoie un contexte structuré et fidèle à buildAgentContext", async () => {
  const root = preparedFixture("simple-dependency");
  try {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "vision_context",
        arguments: { task: "greet function", root },
      });
      const data = jsonContent(result);
      assert.deepStrictEqual(data.matchedFiles.map((f: { path: string }) => f.path), ["src/a.ts"]);
      assert.equal(data.semanticInterpretationApplied, false);
      assert.equal(data.matchedFiles[0].allSymbols, undefined, "liste complète des symboles omise par défaut (économie de tokens)");
      const detailed = jsonContent(await client.callTool({ name: "vision_context", arguments: { task: "greet function", root, detail: true } }));
      assert.ok(Array.isArray(detailed.matchedFiles[0].allSymbols));
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("serveur MCP: vision_inspect résout un fichier par chemin", async () => {
  const root = preparedFixture("simple-dependency");
  try {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "vision_inspect",
        arguments: { query: "src/a.ts", root },
      });
      const data = jsonContent(result);
      assert.equal(data.kind, "file");
      assert.equal(data.file.path, "src/a.ts");
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("serveur MCP: vision_source suit une chaîne de ré-export jusqu'à la déclaration réelle", async () => {
  const root = preparedFixture("re-export");
  try {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "vision_source",
        arguments: { name: "generateToken", root },
      });
      const data = jsonContent(result);
      assert.equal(data.kind, "found");
      assert.equal(data.result.file.path, "src/auth/token.ts");
      assert.equal(data.result.symbol.name, "generate");
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

test("serveur MCP: vision_architecture donne la carte, ou un seul bloc et son voisinage", async () => {
  const root = preparedShop();
  try {
    await withClient(async (client) => {
      const whole = textContent(await client.callTool({ name: "vision_architecture", arguments: { root } }));
      assert.match(whole, /BLOCS \(/);
      assert.match(whole, /Cloud Functions/);
      const block = textContent(await client.callTool({ name: "vision_architecture", arguments: { root, block: "firestore" } }));
      assert.match(block, /^BLOC — Firestore/);
      assert.match(block, /COLLECTIONS \(/);
      assert.ok(block.length < whole.length, "un bloc coûte moins cher que la carte entière");
      const missing = await client.callTool({ name: "vision_architecture", arguments: { root, block: "inexistant" } });
      assert.equal((missing as { isError?: boolean }).isError, true);
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("serveur MCP: vision_flow donne l'algorithme d'une feature, sans les calculs purs par défaut", async () => {
  const root = preparedShop();
  try {
    await withClient(async (client) => {
      const compact = textContent(await client.callTool({ name: "vision_flow", arguments: { root, feature: "placeOrder" } }));
      assert.match(compact, /^FEATURE — placeOrder/);
      assert.match(compact, /APPELÉE PAR/);
      assert.match(compact, /ÉTAPES/);
      const full = textContent(await client.callTool({ name: "vision_flow", arguments: { root, feature: "placeOrder", full: true } }));
      assert.ok(full.length >= compact.length);
      const missing = await client.callTool({ name: "vision_flow", arguments: { root, feature: "nExistePas" } });
      assert.equal((missing as { isError?: boolean }).isError, true);
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
