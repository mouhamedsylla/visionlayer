# Pack Prisma

Prisma décrit les données dans un fichier à part, `schema.prisma`, écrit dans son propre langage. Le code les touche ensuite par le client généré (`prisma.order.create(…)`). Lire seulement le client donne les tables et qui y lit ou écrit. Lire aussi le schéma donne leur forme, leurs états, leurs garanties et ce que l'auteur en dit.

VisionLayer lit donc Prisma avec deux packs livrés :
- `prisma-schema` lit les fichiers `*.prisma` ;
- `prisma` lit le code qui emploie le client.

Un pack `prisma-client` écrit par Muse peut s'y ajouter : il donne les lectures et les écritures de chaque table.

## Le schéma (`prisma-schema`)

| Forme | Exemple | Ce qui est produit |
|---|---|---|
| S1 la source de données | `datasource db { provider = "postgresql" }` | la technologie et la forme des données : `postgresql`, `mysql`, `sqlite`, `sqlserver`, `cockroachdb` donnent `relational` ; `mongodb` donne `document` |
| S2 un modèle | `model OrderItem { … }` | une entité, nommée comme son accès dans le client : la première lettre en minuscule (`orderItem`) |
| S3 un champ | `userId String?` | un champ et son type ; `?` le rend facultatif ; une liste (`String[]`) reste un champ |
| S4 une énumération | `enum OrderStatus { PENDING … }`, puis `status OrderStatus` | les valeurs permises du champ |
| S5 une valeur par défaut | `@default(PENDING)`, `@default(0)`, `@default(false)` | la valeur posée par la base quand elle est littérale. Une fonction (`cuid()`, `now()`, `autoincrement()`) n'est pas une valeur |
| S6 une clé, une unicité, un index | `@id`, `@unique`, `@@id([a, b])`, `@@unique([a, b])`, `@@index([a])` | une contrainte sur ces champs |
| S7 une relation | `user User? @relation(fields: [userId], references: [id], onDelete: SetNull)` | une clé étrangère de `userId` vers l'entité `user`, avec ce qui arrive à la suppression (`Cascade`, `Restrict`, `SetNull`, `SetDefault`, `NoAction`). Le champ de relation (`user`, `items OrderItem[]`) n'est pas une colonne : il n'est pas rendu comme champ |
| S8 un commentaire | `/// …` ou `// …` juste au-dessus d'un champ ou d'un modèle, ou en fin de ligne | ce que l'auteur dit du champ ou du modèle. Les lignes de séparation (`// ====`) sont ignorées |
| S9 le nom en base | `@@map("orders")`, `@map("user_id")` | non lu : le code emploie le nom du modèle et du champ |

Ce pack ne lit pas les types composites de MongoDB (`type Adresse { … }`), les vues (`view`), ni les schémas répartis entre plusieurs bases (`@@schema`).

## Le client (`prisma`)

| Forme | Exemple | Ce qui est produit |
|---|---|---|
| C1 une écriture d'un champ | `x.order.create({ data: { status: "PENDING" } })` ; aussi `update`, `upsert` (`create` et `update`), `createMany`, `updateMany` | une écriture du champ `status` de `order`, avec sa valeur quand elle est littérale |
| C2 une valeur calculée | `data: { status }`, `data: { stock: { decrement: n } }` | une écriture du champ, sans valeur |
| C3 plusieurs lignes | `createMany({ data: items.map((i) => ({ … })) })`, ou un tableau d'objets | les champs de l'objet rendu, à leur ligne |
| C4 une transaction interactive | `x.$transaction(async (tx) => { … })` | les lignes de la transaction |
| C5 une transaction en lot | `x.$transaction([x.a.update(…), x.b.create(…)])` | les lignes du tableau |

Une écriture n'est retenue que si son modèle est déclaré dans un schéma Prisma du dépôt. Un objet `data` qu'on ne voit pas (`data: input`, `data: { ...patch }`) n'écrit aucun champ connu, et rien n'est affirmé sur ses champs. Les écritures imbriquées dans une relation (`items: { create: […] }`) ne sont pas lues.
