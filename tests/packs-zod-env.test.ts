import { test } from "node:test";
import assert from "node:assert/strict";
import type { ArchModelV2 } from "../vision/arch/types.js";
import { mapOf } from "./pack-fixture.js";

/** Une forme par cas, d'après docs/fonctionnement/packs/zod-env.md (Z = le schéma, R = obligatoire ou non). */
const SERVER = { Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "main.ts"]\n` };
const config = (m: ArchModelV2) => m.nodes.find((n) => n.id === "image")?.facets.config?.env ?? [];
const vars = (m: ArchModelV2) => config(m).map((e) => `${e.name}:${e.required}`).sort();

test("zod-env Z1 Z2 Z4 Z5 Z9 R1 R2 R3 : schémas validés sur place, obligatoires ou non", async () => {
  const m = await mapOf({ ...SERVER,
    "a.ts": `import { z } from "zod";\nexport const env = z.object({\n  DATABASE_URL: z.string().url(),\n  PORT: z.coerce.number().default(3000),\n  LOG_LEVEL: z.enum(["info", "debug"]).catch("info"),\n  SENTRY_DSN: z.string().optional(),\n  DB: z.object({ HOST: z.string() }),\n}).parse(process.env);\n`,
    "b.ts": `import * as z from "zod/v4";\nconst r = z.object({ REDIS_URL: z.string(), TRACE: z.optional(z.string()) }).safeParse(process.env);\nexport const ok = r.success;\n`,
    "c.ts": `import z from "zod";\nexport const vite = await z.object({ VITE_API_URL: z.string().nullish() }).parseAsync(import.meta.env);\n`,
    "d.ts": `import { z } from "zod";\nexport const body = z.object({ email: z.string(), PASSWORD: z.string() }).parse({});\nexport const unused = z.object({ UNUSED_KEY: z.string() });\n`,
    "main.ts": `import "./a";\nimport "./b";\nimport "./c";\nimport "./d";\n`,
  });
  assert.deepEqual(vars(m), ["DATABASE_URL:true", "DB:true", "LOG_LEVEL:false", "PORT:false", "REDIS_URL:true", "SENTRY_DSN:false", "TRACE:false", "VITE_API_URL:false"]);
  assert.equal(config(m).find((e) => e.name === "PORT")?.readAt[0]?.line, 4);
});

test("zod-env Z3 Z6 Z7 Z8 : schéma dans une variable, dans un autre fichier, enrichi, composé", async () => {
  const m = await mapOf({ ...SERVER,
    "schema.ts": `import { z } from "zod";\nexport const base = z.object({ DATABASE_URL: z.string() });\nexport const envSchema = base.extend({ STRIPE_KEY: z.string() }).superRefine(() => {});\n`,
    "extra.ts": `import { z } from "zod";\nexport const mail = z.object({ SMTP_URL: z.string().optional() });\n`,
    "env.ts": [
      `import { z } from "zod";`,
      `import { base, envSchema } from "./schema";`,
      `import { mail } from "./extra";`,
      `const merged = z.object({ ...base.shape, NODE_ENV: z.string().default("production") }).merge(mail);`,
      `export const env = envSchema.parse(process.env);`,
      `export const other = merged.parse(process.env);`,
    ].join("\n"),
    "main.ts": `import { env } from "./env";\nconsole.log(env.STRIPE_KEY);\n`,
  });
  assert.deepEqual(vars(m), ["DATABASE_URL:true", "NODE_ENV:false", "SMTP_URL:false", "STRIPE_KEY:true"]);
  // La déclaration, puis l'endroit où la variable est lue.
  assert.deepEqual(config(m).find((e) => e.name === "STRIPE_KEY")?.readAt.map((p) => `${p.path}:${p.line}`), ["schema.ts:3", "main.ts:2"]);
});

test("lecteur générique : une variable lue avec une valeur de repli est facultative, sinon on ne sait pas", async () => {
  const m = await mapOf({ ...SERVER,
    "main.ts": `export const level = process.env.LOG_LEVEL ?? "info";\nexport const port = process.env.PORT || "3000";\nexport const prod = process.env.NODE_ENV === "production";\n`,
  });
  assert.deepEqual(vars(m), ["LOG_LEVEL:false", "NODE_ENV:undefined", "PORT:false"]);
});
