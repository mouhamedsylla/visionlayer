# Inventaire : Fly.io (`fly.toml`)

Pack : [vision/packs/fly.yaml](../../../vision/packs/fly.yaml). Source : la [référence de configuration de Fly](https://fly.io/docs/reference/configuration/) et le guide des [groupes de processus](https://fly.io/docs/launch/processes/).

Chaque forme a un exemple dans [tests/packs-fly.test.ts](../../../tests/packs-fly.test.ts). État : **lu**, **à faire**, **hors pack**.

Une app Fly construit une image et la fait tourner sur des machines. Chaque groupe de processus est un déployable. Sans groupe, l'app lance ce que lance son Dockerfile.

## L'app et ce qu'elle construit

| # | Forme | Exemple | État |
|---|---|---|---|
| A1 | le nom de l'app | `app = "shop-api"` : le nom du déployable quand l'app n'a pas de groupes | lu |
| A2 | le Dockerfile | `[build] dockerfile = "docker/api.Dockerfile"` ; à défaut, le `Dockerfile` à côté de `fly.toml` ; le contexte est le dossier de `fly.toml` | lu |
| A3 | une image déjà construite | `[build] image = "org/api:1"` | hors pack : rien du dépôt n'est lancé |

## Ce que l'app lance

| # | Forme | Exemple | État |
|---|---|---|---|
| P1 | sans groupe de processus | ce que lance le Dockerfile | lu |
| P2 | des groupes de processus | `[processes]` puis `web = "node server.js"`, `worker = "node dist/jobs.js"` : un déployable par groupe ; chemin pris depuis le dossier de `fly.toml`, source du compilé comprise | lu |

## Combien, et avec quoi

| # | Forme | Exemple | État |
|---|---|---|---|
| M1 | le minimum de machines | `[http_service] min_machines_running = 1`, `[[services]] min_machines_running = 2`, pour les groupes de `processes = ["web"]`, sinon pour l'app | lu |
| R1 | la région principale | `primary_region = "cdg"` : un attribut `region` de chaque déployable de l'app (`unit_attr`), montré par l'écran Déploiement | lu |
| M2 | les variables d'environnement | `[env] NODE_ENV = "production"` | lu : les noms seulement (`unit_env_name`), pas encore montrés |

## La syntaxe TOML

| # | Forme | Exemple | État |
|---|---|---|---|
| T1 | commentaires, guillemets simples ou doubles, clés entre guillemets | `"worker" = 'node jobs.js'  # tâches` | lu |
| T2 | un tableau sur plusieurs lignes | `processes = [` puis `"web",` puis `]` | lu |

## Hors pack, ou plus tard

| Forme | Pourquoi |
|---|---|
| `[deploy] release_command = "node dist/migrate.js"` | à faire : un lancement ponctuel (migrations) avant chaque déploiement |
| les secrets (`fly secrets set`) | ne sont pas dans le dépôt ; leurs noms ne sont pas écrits dans `fly.toml` |
| `[[vm]]`, `[mounts]`, `[[statics]]`, `[checks]`, `[metrics]` | n'ont pas d'effet sur ce qui se déploie dans la carte |
| `[build] builder`, buildpacks | à faire : un autre moyen de construire, sans Dockerfile |
