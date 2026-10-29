# Inventaire : Docker Compose

Pack : [vision/packs/compose.yaml](../../../vision/packs/compose.yaml). Source : la [spécification Compose](https://docs.docker.com/reference/compose-file/) ([services](https://docs.docker.com/reference/compose-file/services/), [build](https://docs.docker.com/reference/compose-file/build/), [deploy](https://docs.docker.com/reference/compose-file/deploy/), [fragments](https://docs.docker.com/reference/compose-file/fragments/)).

Chaque forme a un exemple dans [tests/packs-compose.test.ts](../../../tests/packs-compose.test.ts). État : **lu**, **à faire**, **hors pack**.

Un service de la composition est un déployable. S'il construit une image, il lance ce que lance son Dockerfile, sauf s'il donne sa propre commande. S'il part d'une image connue (`postgres`, `redis`), c'est un stockage ou une file.

## Les services

| # | Forme | Exemple | État |
|---|---|---|---|
| C1 | le nom du fichier | `compose.yaml`, `compose.yml`, `docker-compose.yml`, `docker-compose.yaml`, `compose.override.yaml`, `docker-compose.prod.yml` | lu |
| C2 | une image, avec registre, version ou empreinte | `image: postgres:16-alpine`, `image: docker.io/bitnami/redis:7.2@sha256:…` → `postgres`, `redis` | lu |
| C3 | construire depuis un dossier | `build: ./web`, `build: { context: . }` : le `Dockerfile` de ce dossier | lu |
| C4 | construire avec un Dockerfile nommé | `build: { context: ., dockerfile: docker/app.Dockerfile }` : le contexte est celui écrit, pas celui que le pack Docker devine | lu |
| C5 | une image construite et nommée | `build: .` avec `image: org/api:1` : l'image est le nom de ce qui est construit, pas un stockage | lu |

## Ce que le service lance

| # | Forme | Exemple | État |
|---|---|---|---|
| L1 | la commande du Dockerfile | aucun `command` : ce que lance l'image | lu |
| L2 | sa propre commande, chaîne ou liste | `command: node dist/worker.js`, `command: ["pnpm", "exec", "tsx", "src/worker.ts"]` | lu : chemin pris depuis la composition ou depuis le contexte, source du compilé comprise |
| L3 | son propre point d'entrée | `entrypoint: node` puis `command: run.js` | lu |
| L4 | un Dockerfile construit par la composition | son image n'est pas un déployable de plus : ce sont les services qui la lancent | lu |

## Combien, et avec quoi

| # | Forme | Exemple | État |
|---|---|---|---|
| R1 | le nombre de copies | `deploy: { replicas: 2 }`, `scale: 3` | lu |
| R2 | les variables d'environnement, table ou liste | `environment: { NODE_ENV: production }`, `- LOG_LEVEL=info` | lu : les noms seulement (`unit_env_name`), pas encore montrés |
| R3 | des fragments réutilisés | `x-node: &node`, puis `<<: *node` dans un service | lu |

## Hors pack, ou plus tard

| Forme | Pourquoi |
|---|---|
| `env_file: .env` | VisionLayer n'ouvre jamais un fichier `.env` |
| `depends_on` | à faire : l'ordre de démarrage, pas un lien d'exécution ; à montrer quand l'interface le saura |
| `extends`, `include` | à faire : un service ou un fichier défini ailleurs |
| `build.target` | à faire : choisir une étape du Dockerfile (aujourd'hui, la dernière) |
| une commande qui suppose un `WORKDIR` différent du contexte | à faire : le chemin est pris depuis la composition ou le contexte, pas depuis le dossier de travail de l'image |
| `profiles`, `ports`, `volumes`, `networks`, `healthcheck` | n'ont pas d'effet sur ce qui se déploie dans la carte |
