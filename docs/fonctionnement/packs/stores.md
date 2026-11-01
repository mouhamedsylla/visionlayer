# Inventaire : stockages (images de conteneur et pilotes)

Pack : [vision/packs/stores.yaml](../../../vision/packs/stores.yaml). Sources : les [images officielles de Docker Hub](https://hub.docker.com/search?badges=official) (postgres, mysql, mariadb, mongo, redis, rabbitmq, elasticsearch), et la documentation des pilotes : [node-postgres](https://node-postgres.com/) (`pg`), [Postgres.js](https://github.com/porsager/postgres) (`postgres`), [MySQL2](https://sidorares.github.io/node-mysql2/docs) (`mysql2`), le [pilote Node.js de MongoDB](https://www.mongodb.com/docs/drivers/node/current/) (`mongodb`), [Mongoose](https://mongoosejs.com/docs/connections.html), [ioredis](https://github.com/redis/ioredis) et [node-redis](https://github.com/redis/node-redis) (`redis`).

Chaque forme a un exemple dans [tests/packs-stores.test.ts](../../../tests/packs-stores.test.ts). État : **lu**, **à faire**, **hors pack**.

Un stockage est un nœud de la carte, identifié par sa technologie. Il naît d'un service qui part d'une image connue, ou d'une connexion ouverte par le code avec un pilote. Une requête dont le texte nomme une table, ou une opération sur une collection nommée, est un lien `read` ou `write` du déployable vers ce stockage.

## Un service qui part d'une image

| # | Forme | Exemple | État |
|---|---|---|---|
| I1 | une image officielle | `image: postgres:16`, `mysql:8`, `mariadb`, `mongo:7`, `redis:7`, `rabbitmq:3-management`, `elasticsearch:8.15.0` | lu : le stockage porte le nom du service |
| I2 | la même technologie sous un autre nom d'image | `postgis/postgis`, `bitnami/postgresql`, `bitnami/mongodb`, `redis/redis-stack`, `valkey/valkey`, `minio/minio`, `docker.elastic.co/elasticsearch/elasticsearch` | lu |
| I3 | une file de messages | `rabbitmq` : un canal, pas un stockage | lu |
| I4 | une image construite par la composition | `build: .` avec `image: postgres-custom` : un déployable, pas un stockage (Compose C5) | lu |

## Ouvrir une connexion

Importer un pilote ne suffit pas : `import type { Pool } from "pg"` ne connecte à rien. Le stockage naît là où la connexion est créée, et cette ligne en est la preuve.

| # | Forme | Exemple | État |
|---|---|---|---|
| D1 | node-postgres, un pool ou un client | `new pg.Pool({ connectionString })`, `import { Pool, Client } from "pg"; new Client()`, `import pg from "pg"; const { Pool } = pg`, `const { Pool } = require("pg")` | lu |
| D2 | Postgres.js | `import postgres from "postgres"; const sql = postgres(url)` | lu |
| D3 | MySQL2, avec ou sans promesses | `mysql.createPool(url)`, `createConnection({ host })`, `createPoolCluster()`, depuis `mysql2` ou `mysql2/promise` | lu |
| D4 | MongoDB | `new MongoClient(uri)`, `await MongoClient.connect(uri)` | lu |
| D5 | Mongoose | `mongoose.connect(uri)`, `mongoose.createConnection(uri)` | lu |
| D6 | ioredis, un client ou une grappe | `import Redis from "ioredis"; new Redis(url)`, sous n'importe quel nom (`new IORedis()`), `new Redis.Cluster([…])`, `import { Redis, Cluster } from "ioredis"` | lu |
| D7 | node-redis | `createClient({ url })`, `createCluster({ rootNodes })` | lu |
| D8 | une connexion tirée d'une autre | `const client = await pool.connect()`, `pool.getConnection()`, `pool.promise()`, `client.db("app")` | lu : elle mène au même stockage |
| D9 | une connexion exportée, puis importée ailleurs | `export const pool = new Pool()`, `import { pool } from "./db"`, ré-exports compris | lu |

## Lire et écrire

| # | Forme | Exemple | État |
|---|---|---|---|
| Q1 | une requête SQL écrite | `pool.query("SELECT * FROM users WHERE id = $1", [id])`, `conn.execute("UPDATE orders SET …")` : après `FROM` et `JOIN` on lit, après `INSERT INTO`, `UPDATE`, `DELETE FROM` on écrit | lu |
| Q2 | la requête dans un objet | `client.query({ text: "SELECT * FROM users", values })`, `conn.query({ sql: "…" })` | lu |
| Q3 | Postgres.js, un gabarit étiqueté | `` sql`SELECT * FROM users WHERE id = ${id}` ``, `sql.unsafe("DELETE FROM sessions")` | lu |
| Q4 | MongoDB, une collection nommée | `db.collection("users").findOne(…)`, `const users = db.collection("users"); users.insertOne(…)` : `find`, `findOne`, `aggregate`, `countDocuments`, `distinct` lisent ; `insert…`, `update…`, `replace…`, `delete…`, `findOneAnd…`, `bulkWrite` écrivent | lu |
| Q5 | une table ou une collection vue seulement à l'usage | `SELECT … FROM audit_log`, sans schéma déclaré | lu : l'entité apparaît dans le stockage ; une table déclarée (Drizzle) garde sa déclaration comme preuve |

## Les délais (constat `missing_timeout`)

| # | Forme | Exemple | État |
|---|---|---|---|
| T1 | node-postgres sans option de délai | `new pg.Pool({ connectionString, max: 10 })` : la documentation donne `connectionTimeoutMillis` à 0, sans limite ; aucun de `connectionTimeoutMillis`, `query_timeout`, `statement_timeout`, `lock_timeout` | lu |
| T2 | ioredis qui rejoue sans limite | `new IORedis(url, { maxRetriesPerRequest: null })` sans `commandTimeout` | lu |
| T3 | des options qu'on ne voit pas | `new Pool()` (lit les variables `PG…`), `new Pool({ ...base })`, `new Pool(config)` | rien n'est affirmé |
| T4 | un pilote au délai fini par défaut | MySQL2 (`connectTimeout` 10 s), MongoDB (`serverSelectionTimeoutMS` 30 s), node-redis (`connectTimeout` 5 s), Postgres.js (`connect_timeout` 30 s) | rien n'est affirmé |

## Hors pack, ou plus tard

| Forme | Pourquoi |
|---|---|
| les commandes Redis (`redis.get(key)`, `hset`, `publish`) | à faire : une clé est souvent calculée ; un canal `publish`/`subscribe` viendra avec les files |
| les modèles Mongoose (`mongoose.model("User", schema)`, `User.find()`) | à faire : le nom de la collection est dérivé du modèle (pluriel, minuscules) |
| une connexion gardée dans une propriété de classe (`this.pool = new Pool()`) | à faire : le lecteur ne suit pas encore `this` |
| une connexion rendue par une fonction (`getPool().query(…)`) | à faire |
| une requête dont le texte est construit à l'exécution | doit apparaître comme non lu |
| la connexion ouverte par un ORM (`drizzle(url)`, Prisma, TypeORM) | relève du pack de l'ORM : Drizzle déclare ses tables, et leur technologie |
| un `Dockerfile` qui part de `postgres` (`FROM postgres:16`) | à faire : une image construite sur une base de stockage |
| SQLite, DynamoDB, Cassandra, Neo4j… | d'autres technologies : à ajouter forme par forme |
