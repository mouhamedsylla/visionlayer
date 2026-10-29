#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createWebServer } from "../vision/web/server.js";
import { cliArgs } from "../vision/cli/args.js";

/** vision ui [chemin] [--port N] : l'interface locale, sur la carte v2. */
const args = cliArgs();
const portAt = args.indexOf("--port");
const port = Number((portAt >= 0 ? args[portAt + 1] : undefined) ?? process.env.VISION_UI_PORT ?? 4173);
const root = resolve(args.find((a, i) => !a.startsWith("--") && (portAt < 0 || i !== portAt + 1)) ?? ".");
if (!existsSync(root)) {
  console.error(`usage: vision ui [chemin] [--port N]\nLe chemin "${root}" n'existe pas.`);
  process.exit(1);
}

const dist = join(import.meta.dirname, "..", "ui", "dist");
const staticDir = existsSync(dist) ? dist : undefined;
createWebServer({ root, staticDir }).listen(port, "127.0.0.1", () => {
  console.log(`VisionLayer — ${root}`);
  console.log(`http://127.0.0.1:${port}${staticDir ? "" : "  (API seule : pnpm run ui:dev pour l'interface)"}`);
});
