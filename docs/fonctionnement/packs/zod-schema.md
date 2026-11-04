# Zod, schémas des données reçues

Sources : documentation de Zod, objets et types primitifs.

| Forme | Lu |
|---|---|
| `const s = z.object({ a: z.string().min(1) })` | `schema_def`, `schema_field` : champ, type, requis |
| `.optional()`, `.nullish()`, `.default(v)` | champ non requis ; le défaut est gardé |
| `z.array(x)`, `z.enum([...])`, un autre schéma nommé | type écrit tel quel |
| `s.parse(req.body)`, `s.safeParse(req.query)` | `schema_parse`, rattaché à la fonction qui le contient |

Non lu : un schéma composé par `.extend` ou `.merge`, un schéma fabriqué par une fonction.
