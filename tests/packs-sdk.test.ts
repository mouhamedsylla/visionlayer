import { test } from "node:test";
import assert from "node:assert/strict";
import type { ArchModelV2 } from "../vision/arch/types.js";
import { mapOf } from "./pack-fixture.js";

/** Une forme par cas, d'après docs/fonctionnement/packs/sdk.md (K = créer, A = appeler, W = webhook, L = où vit le client). */
const SERVER = (main: string) => ({ Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "${main}"]\n` });
const requests = (m: ArchModelV2) => m.edges.filter((e) => e.kind === "request" && m.nodes.find((n) => n.id === e.to)?.role === "external")
  .flatMap((e) => e.occurrences.map((o) => `${e.to} ${o.path}:${o.line}`)).sort();
const externals = (m: ArchModelV2) => m.nodes.filter((n) => n.role === "external").map((n) => n.id).sort();

test("sdk K1 K2 K3 K4 A1 A2 A3 L1 L2 L3 : clients et appels, d'un fichier à l'autre", async () => {
  const m = await mapOf({ ...SERVER("main.ts"),
    "clients.ts": [
      `import Stripe from "stripe";`,
      `import { Resend } from "resend";`,
      `import nodemailer from "nodemailer";`,
      `export const stripe = new Stripe("k", { apiVersion: "2024-06-20" });`,
      `export const mailer = nodemailer.createTransport({ host: "smtp" });`,
    ].join("\n"),
    "index.ts": `export * from "./clients";\n`,
    "resend.ts": `import { Resend } from "resend";\nexport default new Resend("k");\n`,
    "legacy.js": `const stripe = require("stripe")("k");\nexports.refund = () => stripe.refunds.create({});\n`,
    "named.ts": `import { createTransport } from "nodemailer";\nexport async function ping() {\n  const t = createTransport({});\n  await t.sendMail({});\n}\n`,
    "main.ts": [
      `import { stripe as billing, mailer } from "./index";`,
      `import resend from "./resend";`,
      `import "./legacy";`,
      `import "./named";`,
      `import express from "express";`,
      `import cors from "cors";`,
      `export const a = () => billing.checkout.sessions.create({});`,
      `export const b = () => resend.emails.send({});`,
      `export const c = () => mailer.sendMail({});`,
      `const app = express(); app.use(cors());`,
    ].join("\n"),
  });
  assert.deepEqual(externals(m), ["nodemailer", "resend", "stripe"]);
  assert.deepEqual(requests(m), [
    "nodemailer clients.ts:5", "nodemailer main.ts:9", "nodemailer named.ts:3", "nodemailer named.ts:4",
    "resend main.ts:8", "resend resend.ts:2",
    "stripe clients.ts:4", "stripe legacy.js:1", "stripe legacy.js:2", "stripe main.ts:7",
  ]);
});

test("sdk L4 W1 L5 : client rendu par une fonction, webhook signé, propriété de classe", async () => {
  const m = await mapOf({ ...SERVER("server.ts"),
    "billing.ts": [
      `import Stripe from "stripe";`,
      `let cached: Stripe | undefined;`,
      `export function getStripe() {`,
      `  if (!cached) cached = new Stripe("k");`,
      `  return cached;`,
      `}`,
    ].join("\n"),
    "server.ts": [
      `import express from "express";`,
      `import { getStripe } from "./billing";`,
      `const app = express();`,
      `app.post("/webhook", (req, res) => {`,
      `  const event = getStripe().webhooks.constructEvent(req.body, "sig", "secret");`,
      `  res.json(event);`,
      `});`,
      `app.get("/customers", async (_req, res) => {`,
      `  const s = getStripe();`,
      `  res.json(await s.customers.list());`,
      `});`,
      `app.listen(3000);`,
      `import "./mailer";`,
    ].join("\n"),
    "mailer.ts": `import { Resend } from "resend";\nexport class Mailer {\n  client = new Resend("k");\n  send() { return this.client.emails.send({}); }\n}\n`,
  });
  // La vérification de la signature n'est pas une requête vers Stripe ; la propriété de classe n'est pas encore suivie (L5).
  assert.deepEqual(requests(m), ["resend mailer.ts:3", "stripe billing.ts:4", "stripe server.ts:10"]);
  const entries = m.nodes.find((n) => n.id === "image")?.facets.entrypoints ?? [];
  assert.deepEqual(entries.filter((e) => e.kind === "http").map((e) => `${e.key} ${(e.calledBy ?? []).join(",")}`).sort(), ["GET /customers ", "POST /webhook stripe"]);
});
