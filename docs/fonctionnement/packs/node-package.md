# Paquet Node (`package.json`)

Ce que le pack lit d'un `package.json` : le fichier que désigne `main`, et ce que lance chacun de ses scripts. Un Dockerfile (`CMD ["npm", "start"]`), une composition ou un hébergeur lance souvent un script plutôt qu'un fichier. Sans ce pack, le programme lancé reste inconnu : aucun point d'entrée, aucune lecture, aucune écriture.

Les commandes viennent de la documentation de npm (`npm run`, `npm start`, `--workspace`), de pnpm (`pnpm <script>`, `pnpm run`, `--filter`, `-F`), de Yarn (`yarn <script>`, `yarn run`, `yarn workspace`) et de Bun (`bun run`).

Relations rendues : `pkg_main(Dossier, Fichier)`, `pkg_src(Dossier, Fichier)`, `pkg_name(PackageJson, Nom)` et `pkg_script(PackageJson, Script, Fichier)`. Cette dernière dit le fichier que lance un script, directement ou en passant par d'autres scripts.

## Le fichier que désigne le paquet

| # | Forme | Exemple | État |
|---|---|---|---|
| M1 | `main` ou `module` | `"main": "dist/index.js"` | lu : le fichier, et sa source possible (`src/index.ts`) |

## Ce que lance un script

| # | Forme | Exemple | État |
|---|---|---|---|
| S1 | un fichier de code | `node dist/server.js`, `tsx src/server.ts`, `ts-node-dev --respawn index.ts` | lu : le fichier, et pour du compilé sa source possible : sous `src/` (`dist/a.js` → `src/a.ts`), ou à la place du dossier compilé (`app/dist/index.js` → `app/index.ts`, un `tsc` sans `rootDir`) |
| S2 | des préfixes d'environnement | `dotenv -- node a.js`, `cross-env NODE_ENV=production node a.js`, `node --max-old-space-size=2048 a.js` | lu : les préfixes ne gênent pas |
| S3 | un autre script du même paquet | `npm run build`, `npm start`, `pnpm run worker`, `pnpm worker`, `yarn worker`, `bun run worker` | lu : le script appelé lance ce que lance l'autre |
| S4 | plusieurs commandes | `a && b`, `a & b`, `concurrently "pnpm a" "node b.js"`, `run-p a b`, `npm-run-all --parallel a b` | lu : chaque commande, chaque nom de `run-p` et `npm-run-all` |
| S5 | le script d'un autre paquet, par son nom | `pnpm --filter @app/web start`, `pnpm -F web start`, `yarn workspace web start`, `npm run start -w web` | lu : le paquet de ce nom dans le dépôt |
| S6 | le script d'un autre paquet, par son dossier | `pnpm --filter ./apps/web start`, `npm run start --workspace=apps/web` | lu : le `package.json` de ce dossier |
| S7 | plusieurs paquets à la fois | `pnpm --filter "./packages/*" dev`, `pnpm --filter "@app/*" start`, `pnpm -r dev`, `--filter "!./packages/enterprise"`, plusieurs `--filter` | lu : les paquets du dépôt que désigne chaque motif (dossier `x/*` ou `x/**`, nom `@scope/*` ou exact), moins ceux qu'une exclusion de la même commande retire ; les sélecteurs de graphe (`foo...`, `[origin/main]`) ne sont pas lus |
| S8 | l'exécutable d'un cadre | `next start`, `vite`, `nest start` | hors pack : le pack du cadre sait où est son entrée |

## Un programme sans manifeste

| # | Forme | Exemple | État |
|---|---|---|---|
| P1 | un script qui lance le programme | `"dev": "tsx src/server.ts"`, `"start": "node dist/server.js"`, aussi `serve`, `server`, `prod`, `worker` et `start:x` | lu : un programme au nom du paquet, si le fichier est présent. Sans Dockerfile ni hébergeur, c'est ainsi qu'on sait ce qui tourne. Un manifeste qui lance le même fichier se fond avec lui, et son nom l'emporte. `test`, `build`, `db:*` ne déclarent rien |

Un script qui s'appelle lui-même, directement ou en boucle, ne lance rien de plus : la règle s'arrête sur ce qui est déjà connu.
