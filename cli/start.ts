#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHub, demoProjects } from "../vision/web/hub.js";
import { cliArgs } from "../vision/cli/args.js";

/**
 * `pnpm start` : ouvre VisionLayer ; on y choisit un projet, un dossier ou une adresse GitHub.
 * `pnpm start --demo <dossier>` : la démonstration publique, bornée (PORT et HOST viennent de l'environnement).
 */
const args = cliArgs();
const demoAt = args.indexOf("--demo");
const demo = demoAt >= 0;
const portAt = args.indexOf("--port");
const port = Number((portAt >= 0 ? args[portAt + 1] : undefined) ?? process.env.PORT ?? 4173);
const host = process.env.HOST ?? (demo ? "0.0.0.0" : "127.0.0.1");
const dist = join(import.meta.dirname, "..", "app", "dist");
if (!existsSync(join(dist, "index.html"))) execFileSync("pnpm", ["-s", "app:build"], { cwd: join(import.meta.dirname, ".."), stdio: "inherit" });
if (demo) process.env.VISION_DEMO = "1";
const projects = demo ? demoProjects(resolve(args[demoAt + 1] ?? "demo")) : [];
createHub({ staticDir: dist, projects, demo }).listen(port, host, () => {
  console.log(`VisionLayer : http://${host === "0.0.0.0" ? "localhost" : host}:${port}${demo ? `  (démonstration, ${projects.length} projets)` : ""}`);
});
