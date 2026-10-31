# Inventaire : Drizzle ORM

Pack : [vision/packs/drizzle.yaml](../../../vision/packs/drizzle.yaml). Source : la documentation de Drizzle ([schéma](https://orm.drizzle.team/docs/sql-schema-declaration), [select](https://orm.drizzle.team/docs/select), [insert](https://orm.drizzle.team/docs/insert), [update](https://orm.drizzle.team/docs/update), [delete](https://orm.drizzle.team/docs/delete), [requêtes relationnelles](https://orm.drizzle.team/docs/rqb), [sql](https://orm.drizzle.team/docs/sql), [transactions](https://orm.drizzle.team/docs/transactions), [vues](https://orm.drizzle.team/docs/views)).

Chaque forme a un exemple dans [tests/packs-drizzle.test.ts](../../../tests/packs-drizzle.test.ts). État : **lu**, **à faire**, **hors pack**.

## Déclarer une table

| # | Forme | Exemple | État |
|---|---|---|---|
| S1 | une table, selon la base | `pgTable("users", …)`, `mysqlTable`, `sqliteTable`, `singlestoreTable` | lu (sauf `singlestoreTable` : à faire) |
| S2 | une table dans un schéma nommé | `const app = pgSchema("app"); app.table("users", …)` → `app.users` | lu |
| S3 | un créateur de tables qui préfixe les noms | `pgTableCreator((n) => \`shop_${n}\`)("users", …)` → `shop_users` | lu |
| S4 | le schéma réparti en plusieurs fichiers, réunis par un fichier qui ré-exporte | `schema/index.ts` : `export * from "./users"` | lu |
| S5 | une vue | `pgView("active_users").as((qb) => qb.select().from(users))` : une entité en lecture seule ; la requête qui la définit n'est pas une lecture à l'exécution | lu |

## Lire et écrire

| # | Forme | Exemple | État |
|---|---|---|---|
| Q1 | lire | `db.select().from(users)`, `db.select({ id: users.id }).from(users)` | lu |
| Q2 | lire par une jointure | `.innerJoin(t, …)`, `leftJoin`, `rightJoin`, `fullJoin`, `crossJoin` | lu |
| Q3 | écrire | `db.insert(t).values(…)`, `db.update(t).set(…)`, `db.delete(t)` | lu |
| Q4 | dans une transaction | `db.transaction(async (tx) => tx.insert(t)…)` | lu |
| Q5 | une table importée d'un autre fichier | `import { users } from "./schema"` | lu |
| Q6 | une table lue par son module | `import * as schema from "./schema"; db.select().from(schema.users)` | lu |
| Q7 | compter | `db.$count(users)` | lu |
| Q8 | l'API relationnelle | `db.query.users.findMany()`, `findFirst()` : la clé est le nom exporté de la table | lu : la table est retrouvée par son nom exporté, où qu'elle soit déclarée |
| Q9 | du SQL brut avec une table nommée | `` tx.execute(sql`SELECT … FROM slots WHERE … FOR UPDATE`) `` : lecture de `slots` ; `INSERT INTO`, `UPDATE`, `DELETE FROM` : écriture | lu |
| Q10 | du SQL brut avec la table en variable | `` sql`select * from ${users}` `` | lu |
| Q11 | du SQL brut avec une table qu'aucun fichier ne déclare | une table créée seulement par une migration | à faire : doit apparaître comme non lue, pas disparaître |

## Les colonnes et les contraintes

Lues par [vision/packs/drizzle-columns.ts](../../../vision/packs/drizzle-columns.ts). Chaque colonne est rendue par son nom en base (`userId: uuid("user_id")` → `user_id`) ; sans nom écrit, par sa clé.

| # | Forme | Exemple | État |
|---|---|---|---|
| C1 | une colonne, son type, obligatoire ou non | `text("email").notNull()`, `uuid()`, `(t) => ({ id: t.text() })` | lu |
| C2 | une colonne construite par une fonction du fichier | `const id = () => uuid("id").primaryKey();` puis `id: id()` | lu |
| C3 | une clé primaire | `.primaryKey()` ; `primaryKey({ columns: [t.a, t.b] })` | lu |
| C4 | une unicité | `.unique()`, `.unique("nom")` ; `unique("nom").on(t.a)` | lu |
| C5 | une clé étrangère | `.references(() => users.id)` ; `foreignKey({ columns: [t.a], foreignColumns: [users.id] })` : l'entité visée | lu |
| C6 | un index, unique ou non | `index("nom").on(t.a, t.b)`, `uniqueIndex("nom").on(t.a)` | lu |
| C7 | un index partiel | `` uniqueIndex("nom").on(t.a).where(sql`status = 'open'`) `` : la condition telle qu'écrite | lu |
| C8 | une règle de vérification | `` check("nom", sql`${t.qty} > 0`) `` : la règle telle qu'écrite | lu |
| C9 | une table en fonction qui renvoie un bloc | `(t) => { return [...] }` | à faire : ses contraintes ne sont pas lues |

## Où le code écrit chaque colonne (cycle de vie)

Les mêmes écritures que E4 et E6, rendues en relations neutres : `entity_write(Tech, Entité, Colonne, Valeur, Fichier, Ligne)`, la valeur vide quand le code la calcule, et `entity_default(Tech, Entité, Colonne, Valeur)`. Le modèle les porte sur chaque champ (`default`, `writes`), avec la fonction de premier niveau qui contient l'écriture, son déployable et ses points d'entrée. L'écran d'une entité en tire son cycle de vie.

| # | Forme | Exemple | État |
|---|---|---|---|
| W1 | une valeur par défaut littérale | `.default("open")` | lu |
| W2 | une colonne écrite avec une valeur en clair | `.set({ status: "paid" })`, `.values({ status: "pending" })` : la valeur, la ligne, la fonction | lu |
| W3 | une colonne écrite avec une valeur calculée | `.set({ paidAt: at })`, `.values({ id })` | lu : la colonne et la ligne, sans valeur |
| W4 | la section du schéma où la table est déclarée | `// ── Commandes ──` au-dessus de la table | lu, par la syntaxe (`section`) |
| W5 | une écriture de la ligne entière | `.values(input)`, `.set({ ...patch })` | non : ses colonnes ne sont pas connues |
| W6 | l'état d'où part une écriture | `if (booking.status !== "pending") throw …`, `.where(eq(t.status, "pending"))` | à faire : seule la valeur écrite est lue, pas la condition |

## Où le code lit chaque colonne

Ce qu'une lecture rend, colonne par colonne : `entity_read(Tech, Entité, Colonne, Fichier, Ligne)`, à la ligne du `from` ou de la jointure, la même que celle de l'accès. La colonne vaut `"*"` quand la lecture rend la ligne entière. Le modèle les porte sur chaque champ (`reads`, `whole` pour la ligne entière). La portée d'une modification en tire « qui lit ce champ, depuis quelle route, derrière quelle garde ».

| # | Forme | Exemple | État |
|---|---|---|---|
| R1 | des colonnes nommées dans le select | `db.select({ email: users.email, phone: users.phone }).from(users)` | lu : chaque colonne |
| R2 | la ligne entière | `db.select().from(users)` | lu : toutes les colonnes (`whole`) |
| R3 | la table entière comme valeur du select | `db.select({ user: users }).from(sessions).innerJoin(users, …)` | lu : toutes les colonnes de `users` |
| R4 | les colonnes d'une table jointe | `db.select({ name: users.name }).from(workshops).innerJoin(users, …)` | lu : les colonnes de la table jointe |
| R5 | une colonne seulement dans la condition | `.where(eq(users.id, id))` | non : une condition n'est pas une donnée rendue (voir `read_filter`) |
| R6 | l'API relationnelle | `db.query.users.findMany({ columns: { phone: true } })` | à faire : la lecture est vue, pas ses colonnes |
| R7 | le SQL brut | `` sql`SELECT phone FROM users` `` | à faire : la lecture est vue, pas ses colonnes |

## Les valeurs permises d'une colonne (constat `unused_value`)

| # | Forme | Exemple | État |
|---|---|---|---|
| E1 | une liste de valeurs sur une colonne texte | `text("status", { enum: ["pending", "paid"] })`, `varchar`, `char`, aussi par l'argument d'une table en fonction (`t.text(…)`) | lu |
| E2 | la liste dans une constante du fichier | `const STATUS = ["pending", "paid"] as const;` puis `{ enum: STATUS }` | lu |
| E3 | un type énuméré | `const status = pgEnum("status", ["pending", "paid"])` puis `status("status")` ; `mysqlEnum("status", ["a", "b"])` | lu |
| E4 | écrire une valeur | `.set({ status: "paid" })`, `.values({ status: "paid" })`, `.values([{ … }])`, `.default("pending")` | lu |
| E5 | écrire une valeur en SQL brut | `` sql`UPDATE bookings SET status = 'paid'` `` : chaque texte entre apostrophes d'une écriture dans cette table | lu |
| E6 | écrire sans donner la valeur en clair | `.set({ status: next })`, `.set(patch)`, `.values({ ...input })` | lu : rien n'est affirmé pour cette colonne, ou pour toute la table |
| E7 | la liste importée d'un autre fichier | `import { STATUS } from "./status"` | à faire : la colonne n'a pas de valeurs permises connues |

## Ce que le pack ne prend pas pour une lecture

| Forme | Pourquoi |
|---|---|
| `Array.from(x)`, `cache.delete(k)` | une opération ne compte que si son argument est une table déclarée |
| `` .where(sql`status = 'paid'`) `` | du SQL sans `FROM`, `INTO`, `UPDATE` : une condition, pas un accès |
| la requête qui définit une vue (S5) | elle décrit la vue, elle ne s'exécute pas là où elle est écrite |

## Hors pack

| Forme | Pourquoi |
|---|---|
| les fichiers de migration `drizzle/*.sql` | du SQL hors du code : lus par le pack [Migrations SQL](sql-migrations.md) (les déclencheurs) |
| `drizzle.config.ts` (chemin du schéma, dialecte) | la base est déjà donnée par la fonction de table (`pgTable` → PostgreSQL) |
| une table dont le nom est calculé à l'exécution | doit apparaître comme non lue (RYP-224) |
