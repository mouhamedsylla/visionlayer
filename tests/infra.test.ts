import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildInfraModel } from "../vision/infra/build.js";
import { discoverInfraFiles } from "../vision/infra/discover.js";
import { formatInfraModel } from "../vision/infra/format.js";
import type { InfraModel } from "../vision/infra/types.js";

const FIXTURES = join(import.meta.dirname, "infra-fixtures");
const REFERENCE = join(import.meta.dirname, "..", "examples", "reference-project");

/** Le modèle ne doit contenir aucune VALEUR d'un fichier .env — seulement des noms (gouvernance §4). */
function assertNoDotenvValue(root: string, infra: InfraModel): void {
  const serialized = JSON.stringify(infra);
  for (const s of infra.sources) {
    if (s.format !== "dotenv") continue;
    for (const line of readFileSync(join(root, s.path), "utf-8").split("\n")) {
      const m = line.match(/^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.+?)\s*$/);
      if (m && m[1]!.length >= 6) assert.ok(!serialized.includes(m[1]!), `valeur de ${s.path} retrouvée dans le modèle : ${m[1]}`);
    }
  }
}

for (const name of readdirSync(FIXTURES).filter((n) => statSync(join(FIXTURES, n)).isDirectory())) {
  test(`infra golden fixture: ${name}`, () => {
    const root = join(FIXTURES, name);
    const infra = buildInfraModel(root);
    const expected = JSON.parse(readFileSync(join(root, "expected.infra.json"), "utf-8"));
    assert.deepStrictEqual(infra, expected);
    assertNoDotenvValue(root, infra);
  });
}

test("reference-project : modèle infra complet et stable (golden)", () => {
  const infra = buildInfraModel(REFERENCE);
  const expected = JSON.parse(readFileSync(join(import.meta.dirname, "reference-project.infra.expected.json"), "utf-8"));
  assert.deepStrictEqual(infra, expected);
  assertNoDotenvValue(REFERENCE, infra);
});

test("reference-project : base + surcharge prod fusionnées, différences dev/prod calculées, déclaré étiqueté", () => {
  const infra = buildInfraModel(REFERENCE);
  assert.deepStrictEqual(infra.environments, ["dev", "prod"]);

  const api = infra.components.find((c) => c.id === "service:api")!;
  assert.equal(api.source.kind, "extracted");
  assert.equal((api.source as { path: string }).path, "docker-compose.yml");
  assert.equal(api.attrs.build, ". (Dockerfile)");
  assert.equal(api.perEnv?.prod?.image, "ghcr.io/rypha/reference-api:1.4.0");
  assert.equal(api.perEnv?.prod?.replicas, "2");

  // `db` n'a pas d'image dans la surcharge : il doit rester la base de données, pas devenir un second composant.
  assert.equal(infra.components.filter((c) => c.name === "db").length, 1);
  assert.equal(infra.components.find((c) => c.name === "db")!.kind, "database");

  const nginx = infra.components.find((c) => c.id === "proxy:nginx")!;
  assert.equal(nginx.attrs.tls, "non");
  assert.equal(nginx.perEnv?.prod?.tls, "oui");
  assert.equal(nginx.perEnv?.prod?.domains, "reference.rypha.io");

  const resend = infra.components.find((c) => c.name === "Resend")!;
  assert.equal(resend.source.kind, "declared");
  assert.deepStrictEqual(resend.environments, ["prod"]);
  assert.ok(infra.links.some((l) => l.from === "service:api" && l.to === "platform:resend" && l.source.kind === "declared"));

  assert.ok(infra.links.some((l) => l.from === "proxy:nginx" && l.to === "service:api" && l.kind === "routes_to" && l.label === "reference.rypha.io/api/" && l.environments.includes("prod")));
  assert.ok(infra.links.some((l) => l.from === "image:Dockerfile" && l.to === "service:api" && l.kind === "builds"));
  assert.ok(infra.links.some((l) => l.kind === "deploys" && l.to === "env:prod"));
  assert.ok(infra.links.some((l) => l.from === "tf:aws_cloudfront_distribution.cdn" && l.to === "tf:aws_instance.app"));

  assert.ok(infra.envVars.some((v) => v.name === "SENTRY_DSN" && v.component === "service:api" && v.environments.includes("prod")));
  assert.ok(infra.warnings.some((w) => w.code === "env_only" && w.message.includes("SENTRY_DSN")));
  assert.ok(!infra.warnings.some((w) => w.code === "unknown_link_target"), "toutes les cibles du reference-project doivent se résoudre");
  assert.ok(!JSON.stringify(infra).includes("change-me"), "aucune valeur de .env.example dans le modèle");
});

test("un fichier d'infrastructure illisible n'arrête pas l'extraction des autres", () => {
  const root = mkdtempSync(join(tmpdir(), "vision-infra-"));
  try {
    cpSync(REFERENCE, root, { recursive: true });
    writeFileSync(join(root, "docker-compose.prod.yml"), "services:\n  api:\n    image: [oops\n");
    const infra = buildInfraModel(root);
    const broken = infra.sources.find((s) => s.path === "docker-compose.prod.yml")!;
    assert.ok(broken.parseError, "l'erreur est notée sur la source");
    assert.ok(infra.components.some((c) => c.id === "service:api"), "la base est quand même extraite");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("découverte : reconnaissance par nom puis par contenu, dossiers ignorés", () => {
  const root = mkdtempSync(join(tmpdir(), "vision-infra-"));
  try {
    writeFileSync(join(root, "compose.yaml"), "services: {}\n");
    writeFileSync(join(root, "Caddyfile"), "example.com {\n}\n");
    writeFileSync(join(root, "manifest.yaml"), "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: x\n");
    writeFileSync(join(root, "config.yaml"), "foo: bar\n");
    writeFileSync(join(root, ".env.local"), "X=1\n");
    cpSync(join(FIXTURES, "vercel"), join(root, "node_modules", "pkg"), { recursive: true });
    const found = discoverInfraFiles(root).map((f) => `${f.path}:${f.format}${f.environment ? `:${f.environment}` : ""}`);
    assert.deepStrictEqual(found, [".env.local:dotenv:dev", "Caddyfile:caddy", "compose.yaml:docker-compose", "manifest.yaml:kubernetes"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("format texte : mêmes sections que l'écran Infrastructure", () => {
  const text = formatInfraModel(buildInfraModel(REFERENCE));
  for (const section of ["ENVIRONNEMENTS", "COMPOSANTS", "LIENS", "VARIABLES D'ENVIRONNEMENT — noms uniquement", "DIFFÉRENCES ENTRE ENVIRONNEMENTS", "SOURCES", "POINTS D'ATTENTION"]) {
    assert.ok(text.includes(section), section);
  }
  assert.ok(text.includes("déclaré (.vision/infra.yaml)"));
});
