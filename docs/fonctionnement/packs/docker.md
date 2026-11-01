# Inventaire : Dockerfile

Pack : [vision/packs/docker.yaml](../../../vision/packs/docker.yaml). Source : la [référence Dockerfile](https://docs.docker.com/reference/dockerfile/) et le guide des [builds multi-étapes](https://docs.docker.com/build/building/multi-stage/).

Chaque forme a un exemple dans [tests/packs-docker.test.ts](../../../tests/packs-docker.test.ts). État : **lu**, **à faire**, **hors pack**.

Un Dockerfile construit une image. Le pack cherche le fichier du dépôt que l'image lance : ce fichier devient un déployable, et tout ce qu'il importe en fait partie. Le chemin lancé est un chemin de l'image ; le pack remonte, par `WORKDIR` et `COPY`, au chemin du dépôt d'où il vient.

## Ce que l'image lance

| # | Forme | Exemple | État |
|---|---|---|---|
| D1 | la commande, forme JSON ou forme shell, avec un lanceur | `CMD ["node", "server.js"]`, `CMD tsx src/server.ts`, `pnpm exec`, `npx ts-node`, `bun` | lu |
| D2 | un point d'entrée et ses arguments | `ENTRYPOINT ["node"]` puis `CMD ["dist/server.js"]` | lu |
| D3 | un script du paquet | `CMD ["npm", "start"]`, `pnpm start`, `yarn start`, `npm run serve` : la commande du script dans `package.json` | lu |
| D4 | le code compilé | `RUN pnpm build` puis `CMD node dist/server.js` : `dist/` n'est pas dans le dépôt, sa source `src/server.ts` l'est | lu : la source à la même place sous `src/` |
| D5 | une instruction sur plusieurs lignes | `CMD ["node", \` puis `"server.js"]` | lu |
| D6 | une instruction en minuscules | `cmd ["node", "a.js"]` | lu |

## D'où vient le fichier lancé

| # | Forme | Exemple | État |
|---|---|---|---|
| W1 | le dossier de travail, absolu ou relatif, plusieurs fois | `WORKDIR /app` puis `WORKDIR api` | lu |
| W2 | copier un dossier ou un fichier, avec des options | `COPY . .`, `COPY src ./src`, `COPY --chown=node:node api/ /app/`, `ADD` | lu |
| W3 | une variable dans un chemin | `ARG APP=/srv/app`, `ENV APP_DIR=/app`, `WORKDIR $APP_DIR`, `${APP}` | lu : sa valeur écrite dans le Dockerfile |
| W4 | plusieurs étapes | `FROM node:20 AS build` … `FROM node:20-slim` puis `COPY --from=build /app/dist ./dist` : seule la dernière étape est l'image ; un fichier copié d'une autre étape vient de ce que cette étape a copié | lu |
| W5 | une étape qui part d'une autre | `FROM build AS runtime` : elle hérite de sa commande et de ses fichiers | lu |
| W6 | le contexte de build | il n'est pas écrit dans le Dockerfile : celui que donne le manifeste qui le construit (Compose, Fly) ; à défaut, le dossier du Dockerfile, sinon la racine du dépôt | lu |

## L'image et son nom

| # | Forme | Exemple | État |
|---|---|---|---|
| N1 | le nom du déployable | `api/Dockerfile` → `api` ; `Dockerfile.worker`, `worker.Dockerfile` → `worker` ; `Dockerfile` à la racine → `image` | lu |
| N2 | l'image de départ | `FROM node:20`, `FROM --platform=linux/amd64 ghcr.io/org/node:20@sha256:…` → `node` | lu : relevée (`unit_base`), pas encore montrée |

## Hors pack, ou plus tard

| Forme | Pourquoi |
|---|---|
| `ENTRYPOINT ["./docker-entrypoint.sh"]` | à faire : un script shell qui lance à son tour le programme ; le lecteur ne lit pas encore le shell |
| `EXPOSE 3000`, `HEALTHCHECK` | à faire : le port et la sonde, quand l'interface saura les montrer |
| `RUN`, `USER`, `LABEL`, `VOLUME` | ce que fait le build ne dit pas ce que l'image lance |
| choisir une étape au build (`--target`, `target:` dans Compose) | à faire : aujourd'hui, c'est toujours la dernière étape |
| `.dockerignore`, la syntaxe heredoc | n'ont pas d'effet sur ce que lance l'image dans les formes lues |
| une commande dont le fichier est calculé (`CMD node $ENTRY`) sans valeur écrite | doit apparaître comme non lue |
