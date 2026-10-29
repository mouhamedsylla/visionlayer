# Inventaire : migrations SQL

Pack : [vision/packs/sql-migrations.yaml](../../../vision/packs/sql-migrations.yaml). Il lit les fichiers `.sql` du dépôt, en général les migrations écrites à côté d'un ORM. Source : la documentation de PostgreSQL ([CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html), [CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html)).

Ce qu'il cherche : le code qui s'exécute **dans la base** quand une table change, invisible depuis le code de l'application. Exemple : dans atelier-api, chaque mise à jour de `bookings` écrit une ligne dans `audit_log` par le déclencheur `audit_bookings`. Aucun fichier TypeScript n'écrit `audit_log` : sans ce pack, la table paraît morte.

Chaque forme a un exemple dans [tests/packs-sql-migrations.test.ts](../../../tests/packs-sql-migrations.test.ts).

| # | Forme | Exemple | État |
|---|---|---|---|
| T1 | un déclencheur sur une table | `CREATE TRIGGER audit AFTER INSERT OR UPDATE OF status ON orders …` : la table, les opérations | lu |
| T2 | la fonction qu'il exécute, et ce qu'elle écrit | `EXECUTE FUNCTION audit_orders()` ; `CREATE FUNCTION audit_orders() … $$ … INSERT INTO audit_log … $$` | lu |
| T3 | un corps écrit sur place | `… FOR EACH ROW UPDATE stock SET …` | lu, jusqu'au premier `;` : un corps `BEGIN … END` n'est lu que dans sa première instruction |
| T4 | un déclencheur dans un commentaire | `-- CREATE TRIGGER …` | ignoré |

## Hors pack

| Forme | Pourquoi |
|---|---|
| `CREATE TABLE`, `ALTER TABLE` | le schéma du code (Drizzle) est la source des tables ; une table créée seulement par une migration doit apparaître comme non lue (Drizzle Q11) |
| un déclencheur lu sans base connue | le fichier SQL ne dit pas sa base : le déclencheur revient à l'entité de ce nom, quel que soit son stockage |
| les politiques de ligne (`CREATE POLICY`) | à faire |
