# Inventaire : variables d'environnement déclarées avec Zod

Pack : [vision/packs/zod-env.yaml](../../../vision/packs/zod-env.yaml). Source : la documentation de Zod ([objets](https://zod.dev/api#objects), [parse et safeParse](https://zod.dev/basics), [optional, default, catch](https://zod.dev/api#optionals), [coerce](https://zod.dev/api#coercion), [extend, merge, shape](https://zod.dev/api#extend)), versions 3 et 4.

Chaque forme a un exemple dans [tests/packs-zod-env.test.ts](../../../tests/packs-zod-env.test.ts). État : **lu**, **à faire**, **hors pack**.

Un schéma Zod qui valide l'environnement donne les noms des variables du déployable, et dit lesquelles sont obligatoires. Seuls les noms sont relevés : VisionLayer ne lit jamais une valeur, ni un fichier `.env`.

## Le schéma qui valide l'environnement

| # | Forme | Exemple | État |
|---|---|---|---|
| Z1 | un objet validé sur place | `z.object({ DATABASE_URL: z.string() }).parse(process.env)` | lu |
| Z2 | Zod importé autrement | `import { z } from "zod"`, `import * as z from "zod"`, `import z from "zod"`, `zod/v4`, `zod/mini` | lu |
| Z3 | le schéma dans une variable, validé plus loin | `const schema = z.object({…}); export const env = schema.parse(process.env)` | lu |
| Z4 | les autres façons de valider | `safeParse`, `parseAsync`, `safeParseAsync` | lu |
| Z5 | les autres sources de l'environnement | `import.meta.env` (Vite), `Bun.env` | lu |
| Z6 | le schéma déclaré dans un autre fichier | `import { envSchema } from "./schema"; envSchema.parse(process.env)` | lu |
| Z7 | un schéma enrichi | `.refine(…)`, `.transform(…)`, `.superRefine(…)` entre l'objet et la validation | lu |
| Z8 | un schéma composé | `base.extend({ PORT: … })`, `base.merge(other)`, `z.object({ ...base.shape, PORT: … })` | lu |
| Z9 | un objet imbriqué | `z.object({ DB: z.object({ HOST: … }) })` : seule la clé de premier niveau est une variable (`DB`) | lu |

## Obligatoire ou non

| # | Forme | Exemple | État |
|---|---|---|---|
| R1 | une variable facultative | `.optional()`, `.nullish()`, `z.optional(z.string())` | lu : non obligatoire |
| R2 | une valeur par défaut | `.default("3000")`, `.catch("info")`, `.prefault(…)` | lu : non obligatoire |
| R3 | une conversion | `z.coerce.number()`, `z.string().transform(Number)` | lu : obligatoire, sauf si R1 ou R2 s'ajoute |

## Quand la validation s'exécute

Une validation écrite hors de toute fonction s'exécute dès que son module est chargé. Tout fichier qui la charge par ses imports, même de loin, échoue alors à l'import quand une variable exigée manque, en test comme en production. Le modèle le porte sur la facette de configuration du déployable (`loadChecks` : la ligne, les variables exigées, les fichiers qui la chargent). La tranche le signale sur les fichiers de la tâche : c'est souvent ce qui fait échouer le premier test qu'un agent écrit.

| # | Forme | Exemple | État |
|---|---|---|---|
| L1 | au chargement | `export const env = Env.parse(process.env)` au premier niveau du module | lu : `env_check_at_load`, et les fichiers qui le chargent |
| L2 | dans une fonction | `function readEnv() { return Env.parse(process.env) }` | lu : rien n'est signalé, la validation n'a lieu qu'à l'appel |

## Ce que le pack ne prend pas pour une variable

| Forme | Pourquoi |
|---|---|
| `z.object({ email: z.string() }).parse(req.body)` | un schéma qui ne valide pas l'environnement : un corps de requête, un formulaire |
| un schéma déclaré sans jamais être appliqué à l'environnement | rien ne dit que ce sont des variables |

## Hors pack, ou plus tard

| Forme | Pourquoi |
|---|---|
| `createEnv({ server: {…}, client: {…}, runtimeEnv: process.env })` (`@t3-oss/env-core`, `@t3-oss/env-nextjs`) | une autre bibliothèque construite sur Zod : un autre pack, utile pour Next.js |
| lire une variable par déstructuration : `const { PORT } = env` | à faire : le lecteur relève `env.PORT`, pas encore la déstructuration |
| un schéma construit dans une boucle ou par une fonction | doit apparaître comme non lu |
