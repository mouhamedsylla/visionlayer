# Inventaire : Express

Pack : [vision/packs/express.yaml](../../../vision/packs/express.yaml). Source : la documentation d'Express 4 et 5 ([API](https://expressjs.com/en/5x/api.html), [routage](https://expressjs.com/en/guide/routing.html)).

Chaque forme a un exemple dans [tests/packs-express.test.ts](../../../tests/packs-express.test.ts). État au 01/10/2026 : **lu**, **à faire** (dans le périmètre de la première version), **hors pack** (dit pourquoi).

## Créer une app ou un routeur

| # | Forme | Exemple | État |
|---|---|---|---|
| A1 | une app | `const app = express()` | lu |
| A2 | un routeur | `express.Router()`, `Router()` importé, `Router({ mergeParams: true })` | lu |
| A3 | un routeur créé dans un fichier, ses routes déclarées dans un autre | `import { router } from "./router"; router.get(…)` | lu |
| A4 | une sous-app montée | `const admin = express(); app.use("/admin", admin)` | lu |
| A5 | un routeur fabriqué par une fonction | `export const createMailRouter = (s) => { const router = Router(); …; return router; }`, puis `app.use("/v1/mail", createMailRouter(s))` ou par une variable qui garde l'appel | lu : la fonction désigne le routeur qu'elle rend ; deux fabriques d'un même fichier qui nomment leur routeur pareil se confondent |

## Déclarer une route

| # | Forme | Exemple | État |
|---|---|---|---|
| R1 | une méthode HTTP | `app.get`, `post`, `put`, `patch`, `delete`, `options`, `head`, `all` | lu |
| R2 | les méthodes rares de la documentation | `app.search`, `app.purge`, `app.lock`… | lu |
| R3 | des intermédiaires avant le code | `app.post("/x", auth, validate, h)` : le code est le dernier | lu |
| R4 | des intermédiaires en tableau | `app.get("/x", [auth, log], h)` | lu |
| R5 | un chemin avec paramètres | `/users/:id`, `/users/:id?` | lu |
| R6 | plusieurs chemins | `app.get(["/a", "/b"], h)` | lu |
| R7 | un chemin en expression régulière | `app.get(/.*fly$/, h)` | lu : la clé garde l'expression |
| R8 | une route chaînée | `app.route("/book").get(h1).post(h2)` | lu |
| R9 | un routeur monté sous un préfixe | `app.use("/api", router)` : `GET /api/x` | lu |
| R10 | des routeurs imbriqués | `router.use("/v1", sub)` | lu |
| R11 | un routeur monté sans préfixe | `app.use(router)` | lu |
| R12 | des fichiers servis | `app.use("/static", express.static("public"))` : `GET /static/*` | lu |

## Le code d'une route

| # | Forme | Exemple | État |
|---|---|---|---|
| H1 | une fonction nommée, du fichier ou importée | `app.get("/x", listOrders)` | lu |
| H2 | une fonction écrite sur place | `app.get("/x", (req, res) => …)` | lu |
| H3 | une enveloppe | `route(h)`, `asyncHandler(h)` | lu |
| H4 | une méthode d'un objet | `app.get("/x", orders.list)` avec `import * as orders` | lu |
| H5 | une méthode d'une instance ou d'un objet littéral | `controller.create` avec `const controller = new OrdersController()` | à faire |

## Ce qui protège une route

Nécessaire au constat `unguarded_route` ([Les constats](../constats.md)). Une **garde** est une fonction du dépôt qui répond 401 (garde de connexion) ou 403 (garde de rôle) : `throw new HttpError(403)`, `res.status(403)`, `res.sendStatus(401)`, `next(createError(403))`. Une fonction qui appelle une garde en est une, du même niveau.

| # | Forme | Exemple | État |
|---|---|---|---|
| G1 | un intermédiaire sur la route, ou fabriqué pour elle | `app.post("/x", requireAuth, h)`, `app.get("/x", requireRole("admin"), h)` | lu |
| G2 | un intermédiaire global, placé avant | `app.use(requireAuth)` puis les routes : l'ordre compte ; aussi pour un routeur monté après lui | lu |
| G3 | un intermédiaire sur un routeur ou un préfixe | `router.use(requireAuth)`, `app.use("/admin", requireAdmin)` avant les routes ou le routeur de ce préfixe | lu |
| G4 | une garde appelée dans le code de la route | `const user = await requireUser(req)` dans la fonction de la route, écrite sur place ou importée | lu |
| G5 | une garde appelée comme méthode d'un objet | `await auth.requireAdmin(req)` | à faire |
| G6 | une garde d'une bibliothèque | `passport.authenticate("jwt")`, `expressjwt({ secret })` | à faire : aujourd'hui, elle n'est pas lue comme garde |

## Hors pack

| Forme | Pourquoi |
|---|---|
| une route construite dans une boucle (`for (const r of routes) app[r.method](r.path, r.h)`) | le chemin n'existe qu'à l'exécution : elle doit apparaître comme non lue (RYP-224), pas être devinée |
| `app.param("id", fn)`, un gestionnaire d'erreurs `(err, req, res, next)` | ce ne sont pas des routes |
| les surcouches (NestJS, express-zod-api, tsoa…) | une autre API : un autre pack |
