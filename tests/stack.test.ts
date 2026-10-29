import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as simpleIcons from "simple-icons";
import { buildModel } from "../vision/model/build.js";
import { buildInfraModel } from "../vision/infra/build.js";
import { buildStackModel, packageName } from "../vision/stack/build.js";
import { CATALOG, techsForImage, techsForPackage } from "../vision/stack/catalog.js";
import { diffStacks } from "../vision/stack/diff.js";
import { parseManifest } from "../vision/stack/manifests.js";
import { listProjectFiles } from "../vision/scanner/files.js";
import type { StackModel } from "../vision/stack/types.js";

const MONOREPO = join(import.meta.dirname, "stack-fixtures", "monorepo");

function stackOf(root: string): StackModel {
  return buildStackModel(root, buildModel(root), buildInfraModel(root));
}

test("catalogue : chaque logo référencé existe dans Simple Icons", () => {
  const slugs = new Set((Object.values(simpleIcons) as { slug?: string }[]).map((i) => i?.slug).filter(Boolean));
  const missing = CATALOG.filter((e) => e.icon && !slugs.has(e.icon)).map((e) => `${e.id} → ${e.icon}`);
  assert.deepStrictEqual(missing, []);
  const ids = CATALOG.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "identifiants du catalogue uniques");
});

test("catalogue : nomme sans deviner — motif exact, préfixe, image, extra pip", () => {
  assert.deepStrictEqual(techsForPackage("npm", "react-dom").map((e) => e.id), ["react"]);
  assert.deepStrictEqual(techsForPackage("npm", "@tanstack/query-core").map((e) => e.id), ["tanstack-query"]);
  assert.deepStrictEqual(techsForPackage("npm", "@anthropic-ai/vertex-sdk").map((e) => e.id).sort(), ["anthropic", "vertexai"]);
  assert.deepStrictEqual(techsForPackage("npm", "left-pad"), []);
  assert.deepStrictEqual(techsForImage("postgres:16-alpine").map((e) => e.id), ["postgresql"]);
  assert.deepStrictEqual(techsForImage("docker.io/library/node:20").map((e) => e.id), ["nodejs"]);
  assert.deepStrictEqual(techsForPackage("pypi", "manim-voiceover[azure]").map((e) => e.id), ["azure"]);
  assert.equal(packageName("firebase/auth"), "firebase");
  assert.equal(packageName("@scope/pkg/sub/path"), "@scope/pkg");
  assert.equal(packageName("@/src/stores"), undefined);
});

test("manifestes : package.json, pyproject (PEP 621, extras, build-system), requirements, go.mod, Cargo, composer, Gemfile", () => {
  const py = parseManifest("video/pyproject.toml", '[project]\nname = "v"\nrequires-python = ">=3.11"\ndependencies = [\n  "manim-voiceover[azure]>=0.3",\n  "Python_Dotenv",\n]\n[project.optional-dependencies]\ndev = ["pytest"]\n[build-system]\nrequires = ["setuptools>=68"]\n');
  assert.equal(py.name, "v");
  assert.deepStrictEqual(py.packages.map((p) => [p.name, p.range, p.dev, p.extras ?? []]), [
    ["manim-voiceover", ">=0.3", false, ["azure"]],
    ["python-dotenv", "*", false, []],
    ["pytest", "*", true, []],
    ["setuptools", ">=68", true, []],
  ]);
  assert.deepStrictEqual(py.runtimes.map((r) => [r.tech, r.value]), [["python", ">=3.11"]]);

  const req = parseManifest("requirements-dev.txt", "# outils\nruff==0.6.0\n-r base.txt\nflask>=3 ; python_version>'3.8'\n");
  assert.deepStrictEqual(req.packages.map((p) => [p.name, p.range, p.dev]), [["ruff", "==0.6.0", true], ["flask", ">=3", true]]);

  const go = parseManifest("go.mod", "module example.com/app\n\ngo 1.22\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.10.0\n)\nrequire golang.org/x/text v0.14.0\n");
  assert.equal(go.name, "example.com/app");
  assert.deepStrictEqual(go.packages.map((p) => [p.name, p.range]), [["github.com/gin-gonic/gin", "v1.10.0"], ["golang.org/x/text", "v0.14.0"]]);
  assert.deepStrictEqual(go.runtimes.map((r) => r.value), ["1.22"]);

  const cargo = parseManifest("Cargo.toml", '[package]\nname = "svc"\n[dependencies]\ntokio = { version = "1.38", features = ["full"] }\nserde = "1"\n[dev-dependencies]\ninsta = "1.39"\n');
  assert.deepStrictEqual(cargo.packages.map((p) => [p.name, p.range, p.dev]), [["tokio", "1.38", false], ["serde", "1", false], ["insta", "1.39", true]]);

  const composer = parseManifest("composer.json", '{"name":"acme/site","require":{"php":"^8.2","ext-json":"*","laravel/framework":"^11.0"}}');
  assert.deepStrictEqual(composer.packages.map((p) => p.name), ["laravel/framework"]);
  assert.deepStrictEqual(composer.runtimes.map((r) => [r.tech, r.value]), [["php", "^8.2"]]);

  const gem = parseManifest("Gemfile", "ruby '3.3.0'\ngem 'rails', '~> 7.1'\ngroup :development, :test do\n  gem 'rspec'\nend\n");
  assert.deepStrictEqual(gem.packages.map((p) => [p.name, p.range, p.dev]), [["rails", "~> 7.1", false], ["rspec", "*", true]]);
});

test("monorepo : chaque technologie vient avec ses preuves, ses espaces de travail et ses importeurs", () => {
  const stack = stackOf(MONOREPO);
  const t = (id: string) => stack.technologies.find((x) => x.id === id);

  assert.deepStrictEqual(stack.workspaces.map((w) => w.name).sort(), ["@acme/api", "@acme/web", "acme-video"]);

  const react = t("react")!;
  assert.deepStrictEqual(react.versions, ["^19.0.0"], "version du paquet principal, pas celle de @types/react ni la borne de pair");
  assert.deepStrictEqual(react.workspaces, ["@acme/api", "@acme/web"]);
  assert.deepStrictEqual(react.importers, ["src/App.tsx"]);

  const firebase = t("firebase")!;
  assert.deepStrictEqual(firebase.importers, ["packages/api/src/index.ts", "src/App.tsx"]);
  for (const f of ["Admin SDK", "Authentication", "Firestore"]) assert.ok(firebase.facets.includes(f), `facette ${f}`);

  assert.deepStrictEqual(t("gemini")!.versions, ["^1.29.0", "^2.12.0"]);
  assert.deepStrictEqual(t("nodejs")!.importers, ["src/App.tsx"], "import node: rattaché à Node.js");
  assert.ok(t("nodejs")!.evidence.some((e) => e.kind === "runtime" && e.value === "20"));
  assert.ok(t("pnpm")!.versions.includes("10.33.0"));
  assert.ok(t("vite")!.evidence.some((e) => e.kind === "config" && e.path === "vite.config.ts"));
  assert.ok(t("typescript")!.evidence.some((e) => e.kind === "files"));

  // Python : pyproject + Dockerfile (image, paquets système, pip install avec extra).
  assert.ok(t("python")!.versions.includes(">=3.11,<3.13"));
  assert.ok(t("python")!.versions.includes("3.11"), "tag de l'image python:3.11-slim");
  assert.ok(t("manim")!.evidence.some((e) => e.kind === "package" && e.manifest === "video/Dockerfile" && e.package === "manim-voiceover"));
  assert.ok(t("ffmpeg")!.evidence.some((e) => e.kind === "system" && e.package === "ffmpeg"));
  assert.ok(t("latex")!.evidence.some((e) => e.kind === "system" && e.package === "texlive-latex-base"));
  assert.ok(t("azure")!.facets.includes("Speech (extra pip)"));
  assert.ok(t("openai") && t("pytest"), "optional-dependencies lues");
  assert.ok(t("docker")!.evidence.some((e) => e.kind === "infra"));

  // Hors catalogue : listé sous son nom, jamais caché.
  assert.equal(t("npm:left-pad")?.category, "library");
  // Paquet interne du workspace : jamais une technologie.
  assert.equal(stack.technologies.some((x) => x.name === "@acme/api"), false);
});

test("monorepo : points d'attention — versions divergentes, déclaré jamais importé, import non déclaré", () => {
  const stack = stackOf(MONOREPO);
  const codes = stack.warnings.map((w) => `${w.code}:${w.message.split(" ")[0]}`);
  assert.ok(codes.includes("version_divergence:@google/genai"));
  assert.ok(!codes.some((c) => c === "version_divergence:react"), "`>=18` (pair) ne contredit pas `^19`");
  assert.ok(codes.includes("declared_unused:recharts"));
  assert.ok(codes.includes("declared_unused:left-pad"));
  assert.ok(!codes.some((c) => c.startsWith("declared_unused:vite")), "un outil de build n'est pas « jamais importé »");
  assert.ok(stack.warnings.some((w) => w.code === "undeclared_import" && w.message.includes("unlisted-lib")));
});

test("inventaire déterministe, et diff entre deux scans (ajout, retrait, version)", () => {
  const a = stackOf(MONOREPO);
  assert.deepStrictEqual(stackOf(MONOREPO), a);

  const root = mkdtempSync(join(tmpdir(), "vision-stack-"));
  cpSync(MONOREPO, root, { recursive: true });
  const before = stackOf(root);
  // node_modules présent : la version installée devient la version affichée.
  mkdirSync(join(root, "node_modules", "react"), { recursive: true });
  writeFileSync(join(root, "node_modules", "react", "package.json"), '{"name":"react","version":"19.2.7"}');
  writeFileSync(join(root, "packages", "api", "package.json"), '{"name":"@acme/api","engines":{"node":"20"},"dependencies":{"@google/genai":"^2.12.0","hono":"^4.6.0","firebase-admin":"^12.7.0","zod":"^3.25.76"}}');
  const after = stackOf(root);
  const d = diffStacks(before, after);
  assert.deepStrictEqual(d.added.map((t) => t.id), ["hono"]);
  assert.deepStrictEqual(d.removed.map((t) => t.id), ["express"]);
  assert.ok(d.changed.some((c) => c.id === "react" && c.after.includes("19.2.7")));
  const ev = after.technologies.find((t) => t.id === "react")!.evidence.find((e) => e.kind === "package" && e.package === "react" && e.manifest === "package.json");
  assert.equal(ev?.kind === "package" ? ev.installed : undefined, "19.2.7");
});

test("fichiers du projet : .gitignore respecté, lien symbolique en boucle jamais suivi", () => {
  const root = mkdtempSync(join(tmpdir(), "vision-files-"));
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "ressources"));
  writeFileSync(join(root, "src", "a.ts"), "export const a = 1;\n");
  writeFileSync(join(root, "ressources", "notes.ts"), "export const n = 1;\n");
  symlinkSync(".", join(root, "ressources", "ressources"));

  // Hors git : parcours du disque, sans suivre le lien (Nafar : ressources/ressources → .).
  assert.deepStrictEqual(listProjectFiles(root).map((f) => f.path), ["ressources/notes.ts", "src/a.ts"]);

  // Dans git : ce que .gitignore exclut n'appartient pas au projet.
  writeFileSync(join(root, ".gitignore"), "ressources/\n");
  execFileSync("git", ["init", "-q"], { cwd: root });
  assert.deepStrictEqual(listProjectFiles(root).map((f) => f.path), [".gitignore", "src/a.ts"]);
});
