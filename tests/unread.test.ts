import { test } from "node:test";
import assert from "node:assert/strict";
import { mapOf } from "./pack-fixture.js";
import type { ArchModelV2 } from "../vision/arch/types.js";

const node = (m: ArchModelV2, name: string) => m.nodes.find((n) => n.name === name);
const files = (m: ArchModelV2) => m.coverage.find((c) => c.unit === "files")!;

test("non lu : une app d'un framework sans pack est sur la carte, nommée par le service qui la construit, et pas comprise", async () => {
  const m = await mapOf({
    "package.json": JSON.stringify({ name: "shop", dependencies: { next: "15.0.0", react: "19.0.0" }, scripts: { build: "next build", start: "next start" } }),
    "Dockerfile": "FROM node:22\nWORKDIR /app\nCOPY . .\nRUN npm run build\nCMD [\"node\", \"server.js\"]\n",
    "docker-compose.yml": "services:\n  web:\n    build: .\n  db:\n    image: postgres:17\n",
    "next.config.ts": "import type { NextConfig } from \"next\";\nconst config: NextConfig = {};\nexport default config;\n",
    "src/app/page.tsx": "import Link from \"next/link\";\nexport default function Home() { return <Link href=\"/a\">a</Link>; }\n",
    "src/app/api/orders/route.ts": "import { NextResponse } from \"next/server\";\nexport async function GET() { return NextResponse.json([]); }\n",
  });
  const web = node(m, "web");
  assert.ok(web, "l'app est sur la carte");
  assert.equal(web.role, "app");
  assert.deepEqual(web.tech, ["nextjs"], "les frameworks que son code importe");
  assert.match(web.subtitle!, /non lu/);
  assert.equal(web.facets.entrypoints, undefined, "aucun point d'entrée inventé");
  assert.ok(files(m).gaps.some((g) => g.kind === "pack_missing" && g.subject === "Next.js"));
  assert.equal(files(m).understood, 0, "analysés, mais aucun n'est exécuté par un programme lu");
  assert.ok(files(m).read >= 3);
});

test("non lu : un serveur lancé par son image sans pack, et des services appelés par leur bibliothèque, reliés à qui les importe", async () => {
  const m = await mapOf({
    "package.json": JSON.stringify({ name: "@acme/archive", main: "src/server.ts" }),
    "docker-compose.yml": "services:\n  archive:\n    image: acme/archive:latest\n  search:\n    image: getmeili/meilisearch:v1.15\n",
    "Dockerfile": "FROM node:22\nCOPY . .\nCMD [\"node\", \"src/server.ts\"]\n",
    "src/server.ts": "import { MeiliSearch } from \"meilisearch\";\nimport { S3Client } from \"@aws-sdk/client-s3\";\nexport const search = new MeiliSearch({ host: \"http://search:7700\" });\nexport const s3 = new S3Client({});\n",
  });
  const search = node(m, "search");
  assert.ok(search, "le moteur de recherche est sur la carte");
  assert.equal(search.role, "store");
  assert.deepEqual(search.tech, ["meilisearch"]);
  assert.match(search.subtitle!, /non lue/);
  const aws = m.nodes.find((n) => n.tech?.includes("aws") && n.level === "system");
  assert.ok(aws, "AWS est un service extérieur, non lu");
  const uses = m.edges.filter((e) => e.kind === "use").map((e) => `${e.from} ${e.to}`).sort();
  assert.equal(uses.length, 2);
  assert.ok(uses.every((u) => u.split(" ")[1] === search.id || u.split(" ")[1] === aws.id));
  assert.equal(node(m, "archive"), undefined, "l'image que le dépôt publie lui-même n'est pas un service de plus");
});

test("noms : un programme lancé par une image prend le nom du script de son paquet, ou le nom du paquet", async () => {
  const m = await mapOf({
    "package.json": JSON.stringify({ name: "root", scripts: { "docker-start": "concurrently \"pnpm --filter @acme/backend start\" \"pnpm --filter @acme/backend start:mail-worker\"" }, workspaces: ["packages/*"] }),
    "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
    "docker/Dockerfile": "FROM node:22\nCOPY . .\nCMD [\"pnpm\", \"docker-start\"]\n",
    "packages/backend/package.json": JSON.stringify({ name: "@acme/backend", scripts: { start: "node dist/index.js", "start:mail-worker": "node dist/workers/mail.worker.js", "start:mail-worker:dev": "tsx src/workers/mail.worker.ts", dev: "tsx src/index.ts" } }),
    "packages/backend/src/index.ts": "import express from \"express\";\nconst app = express();\napp.get(\"/health\", (_req, res) => res.send(\"ok\"));\napp.listen(3000);\n",
    "packages/backend/src/workers/mail.worker.ts": "console.log(\"mail\");\n",
  });
  const names = m.nodes.filter((n) => n.level === "deployable").map((n) => n.name).sort();
  assert.deepEqual(names, ["backend", "mail-worker"]);
});
