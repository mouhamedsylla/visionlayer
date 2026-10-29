# Inventaire : Vite et React

Packs : [vision/packs/html.yaml](../../../vision/packs/html.yaml) (la page qui charge l'app) et [vision/packs/vite.yaml](../../../vision/packs/vite.yaml) (la configuration de Vite). Sources : la documentation de Vite ([index.html et la racine](https://vite.dev/guide/#index-html-and-project-root), [app à plusieurs pages](https://vite.dev/guide/build#multi-page-app), [variables d'environnement](https://vite.dev/guide/env-and-mode), [configuration](https://vite.dev/config/shared-options)) et de React ([createRoot](https://react.dev/reference/react-dom/client/createRoot)).

Chaque forme a un exemple dans [tests/packs-vite-react.test.ts](../../../tests/packs-vite-react.test.ts). État : **lu**, **à faire**, **hors pack**.

Une app Vite est un déployable dont l'entrée est une page HTML : la page charge un module, tout ce que ce module importe fait partie de l'app. Les écrans de l'app (routes, composants) seront lus avec les écrans ; cet inventaire couvre ce que la carte montre aujourd'hui.

## La page

| # | Forme | Exemple | État |
|---|---|---|---|
| H1 | un module chargé par la page | `<script type="module" src="/src/main.tsx">` : `/` part du dossier de la page (la racine de Vite) | lu |
| H2 | les attributs dans un autre ordre, sur plusieurs lignes | `<script` puis `src="/src/main.tsx"` puis `type="module"></script>` | lu |
| H3 | un chemin relatif | `src="./src/main.ts"`, `src="src/main.ts"` | lu |
| H4 | un module écrit dans la page | `<script type="module">import "./main.ts"</script>` | lu |
| H5 | une app à plusieurs pages | `index.html` et `admin/index.html` : une app par page qui charge un module | lu |
| H6 | une page sans module | `public/offline.html`, une page servie telle quelle | lu : pas une app |

## Vite

| # | Forme | Exemple | État |
|---|---|---|---|
| V1 | la configuration à côté de la page | `vite.config.ts`, `.js`, `.mjs`, `.mts` : l'app est faite avec Vite | lu |
| V2 | une autre racine | `defineConfig({ root: "client" })` : la page est dans `client/`, chemin lu depuis le dossier d'où Vite est lancé, celui de la configuration ou la racine du dépôt (`vite --config web/vite.config.ts` avec `root: "web"`) | lu |
| V3 | les variables exposées au code | `import.meta.env.VITE_API_URL` | lu : un nom de variable |
| V4 | les valeurs fournies par Vite | `import.meta.env.MODE`, `DEV`, `PROD`, `SSR`, `BASE_URL` | lu : pas des variables d'environnement |

## React

| # | Forme | Exemple | État |
|---|---|---|---|
| R1 | l'app montée dans la page | `createRoot(document.getElementById("root")).render(<App />)`, `hydrateRoot` | lu : la technologie vient de l'import de `react-dom` |
| R2 | les routes de l'app | `<Route path="/bookings/:id" element={…}>`, `createBrowserRouter([{ path, element }])` | à faire, avec les écrans |
| R3 | les composants, et les données qu'ils chargent | `useQuery({ queryFn: () => api("/x") })`, `useEffect(() => { fetch(…) })` | les appels HTTP sont lus par le pack fetch et axios ; les composants, avec les écrans |

## Hors pack, ou plus tard

| Forme | Pourquoi |
|---|---|
| `server.proxy` avec `rewrite` (`/api/x` envoyé vers `/x`) | à faire : le moteur de règles ne sait pas encore retirer un préfixe d'un chemin ; un proxy sans `rewrite` garde le chemin et ne change rien |
| `envPrefix: "APP_"` | à faire : d'autres noms exposés au code |
| `loadEnv`, `.env.production` | VisionLayer n'ouvre jamais un fichier `.env` |
| les pages produites par le build (`dist/index.html`) | leur module n'est pas dans le dépôt : pas une app |
