import { test } from "node:test";
import assert from "node:assert/strict";
import type { ArchModelV2 } from "../vision/arch/types.js";
import { mapOf } from "./pack-fixture.js";

/** Une forme par cas, d'après docs/fonctionnement/packs/express.md (A = app, R = route, H = code). */
const SERVER = { Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "server.ts"]\n` };
const routes = (m: ArchModelV2) => (m.nodes.find((n) => n.id === "image")?.facets.entrypoints ?? []).filter((e) => e.kind === "http").map((e) => e.key).sort();
const handler = (m: ArchModelV2, key: string) => {
  const e = m.nodes.find((n) => n.id === "image")?.facets.entrypoints?.find((x) => x.key === key);
  return e?.handler ? `${e.handler.path}:${e.handler.line} ${e.handler.name}` : undefined;
};

test("express A1 R1 R2 R3 R4 R5 : méthodes, intermédiaires, paramètres", async () => {
  const m = await mapOf({ ...SERVER, "server.ts": [
    `import express from "express";`,
    `const app = express();`,
    `const auth = (req: any, res: any, next: any) => next();`,
    `app.get("/users/:id", (req, res) => res.end());`,
    `app.post("/users", auth, (req, res) => res.end());`,
    `app.delete("/users/:id?", [auth, auth], (req, res) => res.end());`,
    `app.all("/ping", (req, res) => res.end());`,
    `app.search("/find", (req, res) => res.end());`,
    `const cache = new Map(); cache.get("/not-a-route");`,
    `app.listen(3000);`,
  ].join("\n") });
  assert.deepEqual(routes(m), ["ANY /ping", "DELETE /users/:id?", "GET /users/:id", "POST /users", "SEARCH /find"]);
});

test("express R6 R7 R8 : plusieurs chemins, expression régulière, route chaînée", async () => {
  const m = await mapOf({ ...SERVER, "server.ts": [
    `import express from "express";`,
    `const app = express();`,
    `app.get(["/a", "/b"], (req, res) => res.end());`,
    `app.get(/.*fly$/, (req, res) => res.end());`,
    `app.route("/book").get((req, res) => res.end()).post((req, res) => res.end());`,
  ].join("\n") });
  assert.deepEqual(routes(m), ["GET /.*fly$/", "GET /a", "GET /b", "GET /book", "POST /book"]);
});

test("express A2 A3 A4 R9 R10 R11 R12 : routeurs d'autres fichiers, préfixes imbriqués, sous-app, fichiers servis", async () => {
  const m = await mapOf({ ...SERVER,
    "server.ts": [
      `import express from "express";`,
      `import users from "./routes/users";`,
      `import { health } from "./routes/health";`,
      `import { admin } from "./admin";`,
      `const app = express();`,
      `app.use("/api", users);`,
      `app.use(health);`,
      `app.use("/admin", admin);`,
      `app.use("/static", express.static("public"));`,
    ].join("\n"),
    "routes/users.ts": [
      `import { Router } from "express";`,
      `import { v1 } from "./v1";`,
      `const router = Router({ mergeParams: true });`,
      `router.get("/", (req, res) => res.end());`,
      `router.use("/v1", v1);`,
      `export default router;`,
    ].join("\n"),
    "routes/v1.ts": `import express from "express";\nexport const v1 = express.Router();\nimport "./v1-routes";\n`,
    "routes/v1-routes.ts": `import { v1 } from "./v1";\nv1.get("/stats", (req, res) => res.end());\n`,
    "routes/health.ts": `import express from "express";\nexport const health = express.Router();\nhealth.get("/healthz", (req, res) => res.end());\n`,
    "admin.ts": `import express from "express";\nexport const admin = express();\nadmin.get("/", (req, res) => res.end());\n`,
  });
  // Les routes de v1 sont déclarées dans un autre fichier que le routeur : le préfixe /api/v1 les suit.
  assert.deepEqual(routes(m), ["GET /admin", "GET /api", "GET /api/v1/stats", "GET /healthz", "GET /static/*"]);
});

test("express H1 H3 H4 : le code d'une route, nommé, enveloppé, membre d'un module", async () => {
  const m = await mapOf({ ...SERVER,
    "server.ts": [
      `import express from "express";`,
      `import * as orders from "./orders";`,
      `import { listItems } from "./items";`,
      `const app = express();`,
      `const route = (h: any) => h;`,
      `app.get("/items", route(listItems));`,
      `app.get("/orders", orders.list);`,
    ].join("\n"),
    "items.ts": `export function listItems() {}\n`,
    "orders.ts": `export const list = () => [];\n`,
  });
  assert.equal(handler(m, "GET /items"), "items.ts:1 listItems");
  assert.equal(handler(m, "GET /orders"), "orders.ts:1 orders.list");
});

test("express G1 à G4 : les gardes d'une route, et le constat unguarded_route", async () => {
  const m = await mapOf({
    Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "main.ts"]\n`,
    "guards.ts": [
      `export class HttpError extends Error { constructor(public status: number) { super(); } }`,
      `export async function requireUser(req: any) { if (!req.user) throw new HttpError(401); return req.user; }`,
      `export async function requireAdmin(req: any) { const u = await requireUser(req); if (u.role !== "admin") throw new HttpError(403); return u; }`,
      `export function requireRole(role: string) { return (req: any, res: any, next: any) => (req.user?.role === role ? next() : res.status(403).end()); }`,
      `export function mwAdmin(req: any, res: any, next: any) { if (req.user?.role !== "admin") return res.sendStatus(403); next(); }`,
    ].join("\n"),
    "admin.ts": [
      `import { Router } from "express";`,
      `import { mwAdmin } from "./guards";`,
      `const h = (req: any, res: any) => {};`,
      `export const adminRouter = Router();`,
      `adminRouter.use(mwAdmin);`,
      `adminRouter.get("/stats", h);`,
      `export const openRouter = Router();`,
      `openRouter.get("/open", h);`,
    ].join("\n"),
    "main.ts": [
      `import express from "express";`,
      `import { requireUser, requireAdmin, requireRole, mwAdmin } from "./guards";`,
      `import { adminRouter, openRouter } from "./admin";`,
      `const app = express();`,
      `const h = (req: any, res: any) => {};`,
      `app.get("/admin/g1", mwAdmin, h);`,
      `app.get("/admin/g1f", requireRole("admin"), h);`,
      `app.get("/admin/early", h);`,
      `app.use("/admin/zone", mwAdmin);`,
      `app.get("/admin/zone/x", h);`,
      `app.get("/admin/g4", async (req: any, res: any) => { await requireAdmin(req); });`,
      `app.get("/admin/user-only", async (req: any, res: any) => { await requireUser(req); });`,
      `app.use("/admin/r", adminRouter);`,
      `app.use("/admin/o", openRouter);`,
      `app.get("/public", h);`,
      `app.use(mwAdmin);`,
      `app.get("/admin/late", h);`,
    ].join("\n"),
  });
  const unguarded = m.findings.filter((f) => f.code === "unguarded_route").map((f) => `${f.proof[0]!.path}:${f.proof[0]!.line} ${f.message}`).sort();
  assert.deepEqual(unguarded, [
    "admin.ts:8 « GET /admin/o/open » : le chemin dit admin, mais aucune garde lue ne vérifie un rôle (aucune fonction du dépôt qui réponde 403)",
    "main.ts:12 « GET /admin/user-only » : le chemin dit admin, mais la route n'est gardée que par une connexion (401), sans garde de rôle (403)",
    "main.ts:8 « GET /admin/early » : le chemin dit admin, mais aucune garde lue ne vérifie un rôle (aucune fonction du dépôt qui réponde 403)",
  ]);
  // La garde écrite sur chaque route : son niveau, et la fonction qui la tient.
  const access = Object.fromEntries(m.nodes.flatMap((n) => n.facets.entrypoints ?? []).filter((e) => e.kind === "http")
    .map((e) => [e.key, e.access ? `${e.access.level}${e.access.by ? ` ${e.access.by.name} ${e.access.by.path}:${e.access.by.line}` : ""}` : "?"]));
  assert.deepEqual(access, {
    "GET /admin/g1": "role mwAdmin guards.ts:5",
    "GET /admin/g1f": "role requireRole guards.ts:4",
    "GET /admin/early": "public",
    "GET /admin/zone/x": "role mwAdmin guards.ts:5",
    "GET /admin/g4": "role requireAdmin guards.ts:3",
    "GET /admin/user-only": "authenticated requireUser guards.ts:2",
    "GET /admin/r/stats": "role mwAdmin guards.ts:5",
    "GET /admin/o/open": "public",
    "GET /public": "public",
    "GET /admin/late": "role mwAdmin guards.ts:5",
  });
});
