import { test } from "node:test";
import assert from "node:assert/strict";
import type { ArchModelV2 } from "../vision/arch/types.js";
import { mapOf } from "./pack-fixture.js";

/** Une forme par cas, d'après docs/fonctionnement/packs/vite-react.md (H = la page, V = Vite, R = React). */
const apps = (m: ArchModelV2) => m.nodes.filter((n) => n.role === "app")
  .map((n) => `${n.id} ${n.facets.entrypoints?.find((e) => e.kind === "main")?.key} [${(n.tech ?? []).join(",")}] {${(n.facets.config?.env ?? []).map((e) => e.name).join(",")}} ${n.files?.length}`).sort();

test("vite-react H1 à H6, V1 V3 V4, R1 : pages, modules, configuration, variables", async () => {
  const m = await mapOf({
    "web/index.html": `<!doctype html>\n<div id="root"></div>\n<script\n  src="/src/main.tsx"\n  type="module"\n></script>\n`,
    "web/vite.config.ts": `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nexport default defineConfig({ plugins: [react()] });\n`,
    "web/src/main.tsx": `import { createRoot } from "react-dom/client";\nimport { App } from "./App";\ncreateRoot(document.getElementById("root")!).render(<App />);\n`,
    "web/src/App.tsx": `export function App() {\n  const api = import.meta.env.VITE_API_URL;\n  return <p>{api}{String(import.meta.env.DEV)}{import.meta.env.MODE}{import.meta.env.BASE_URL}{String(import.meta.env.PROD)}</p>;\n}\n`,
    "admin/index.html": `<!doctype html>\n<script type="module">\n  import "./main.ts";\n</script>\n`,
    "admin/main.ts": `export {};\n`,
    "shop/index.html": `<script type="module" src="./src/main.ts"></script>\n`,
    "shop/src/main.ts": `export {};\n`,
    "public/offline.html": `<p>hors ligne</p>\n`,
  });
  assert.deepEqual(apps(m), [
    "admin admin/index.html [] {} 1",
    "shop shop/index.html [] {} 1",
    "web web/index.html [react,vite] {VITE_API_URL} 2",
  ]);
});

test("vite-react V2 : une autre racine", async () => {
  const m = await mapOf({
    "vite.config.mts": `import { defineConfig } from "vite";\nexport default defineConfig({ root: "client", server: { port: 5173 } });\n`,
    "client/index.html": `<script type="module" src="/src/main.ts"></script>\n`,
    "client/src/main.ts": `export {};\n`,
  });
  assert.deepEqual(apps(m), ["client client/index.html [vite] {} 1"]);
  // Lancé depuis la racine du dépôt : `vite --config front/vite.config.ts`, avec `root: "front"`.
  const n = await mapOf({
    "front/vite.config.ts": `import { defineConfig } from "vite";\nexport default defineConfig({ root: "front" });\n`,
    "front/index.html": `<script type="module" src="/src/main.ts"></script>\n`,
    "front/src/main.ts": `export {};\n`,
  });
  assert.deepEqual(apps(n), ["front front/index.html [vite] {} 1"]);
});

test("lecteur générique : les modules .mjs, .cjs, .mts, .cts sont lus et suivis", async () => {
  const m = await mapOf({
    "Dockerfile": `FROM node:20\nCOPY . .\nCMD ["node", "server.mjs"]\n`,
    "server.mjs": `import { a } from "./lib/a.cjs";\nimport "./lib/b.mts";\nexport default a;\n`,
    "lib/a.cjs": `module.exports.a = 1;\n`,
    "lib/b.mts": `import "./c";\n`,
    "lib/c.cts": `export {};\n`,
  });
  assert.deepEqual(m.nodes.find((n) => n.id === "image")?.files, ["lib/a.cjs", "lib/b.mts", "lib/c.cts", "server.mjs"]);
});
