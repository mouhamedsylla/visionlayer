import { test } from "node:test";
import assert from "node:assert/strict";
import type { ArchModelV2 } from "../vision/arch/types.js";
import { mapOf } from "./pack-fixture.js";

/** Une forme par cas, d'après docs/fonctionnement/packs/logs.md (J = journal, W = ce qui est écrit). */
const SERVER = { Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "main.ts"]\n` };
const logged = (m: ArchModelV2) => m.findings.filter((f) => f.code === "personal_data_logged").map((f) => `${f.proof[0]!.path}:${f.proof[0]!.line} ${f.message}`).sort();

test("logs J1 J2 J4 J5 W1 : le corps d'une requête, par pino importé, par un enfant, par la console", async () => {
  const m = await mapOf({ ...SERVER,
    "logger.ts": `import pino from "pino";\nexport const logger = pino({ level: "info" });\n`,
    "index.ts": `export * from "./logger";\n`,
    "main.ts": [
      `import express from "express";`,
      `import { logger } from "./index";`,
      `const app = express();`,
      `const log = logger.child({ module: "auth" });`,
      `export async function signup(req: any, res: any) {`,
      `  logger.info({ body: req.body }, "signup");`,
      `}`,
      `app.post("/signup", signup);`,
      `app.post("/login", (req: any, res: any) => { log.warn(req.body); });`,
      `app.post("/x", (req: any, res: any) => { console.log("x", req.body); });`,
      `export function notAHandler(msg: any) { logger.info(msg.body); }`,
    ].join("\n"),
  });
  const body = "le corps entier d'une requête HTTP est écrit dans le journal : tout ce que le client envoie, données personnelles comprises";
  assert.deepEqual(logged(m), [`main.ts:10 ${body}`, `main.ts:6 ${body}`, `main.ts:9 ${body}`]);
});

test("logs J3 W2 W3 : winston, champs personnels, journal qui masque", async () => {
  const m = await mapOf({ ...SERVER,
    "main.ts": [
      `import winston from "winston";`,
      `import pino from "pino";`,
      `const logger = winston.createLogger({ level: "info" });`,
      `const safe = pino({ redact: ["email"] });`,
      `export function f(user: any, input: any, users: any[]) {`,
      `  logger.info({ userEmail: user.email, id: user.id });`,
      `  console.log(user.phone);`,
      "  logger.log(\"info\", `reset for ${input.password}`);",
      `  logger.info({ count: users.filter((u) => u.email).length });`,
      `  safe.info({ email: user.email });`,
      `  logger.info("password reset requested");`,
      `}`,
    ].join("\n"),
  });
  assert.deepEqual(logged(m), [
    "main.ts:6 le champ « userEmail » est écrit dans le journal",
    "main.ts:7 le champ « phone » est écrit dans le journal",
    "main.ts:8 le champ « password » est écrit dans le journal",
  ]);
});
