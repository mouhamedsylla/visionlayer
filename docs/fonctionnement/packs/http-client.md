# Inventaire : appels HTTP sortants (fetch, axios)

Pack : [vision/packs/http-client.yaml](../../../vision/packs/http-client.yaml). Sources : le standard [Fetch](https://fetch.spec.whatwg.org/) ([MDN](https://developer.mozilla.org/docs/Web/API/Window/fetch)) et la documentation d'axios ([API](https://axios-http.com/docs/api_intro), [instances](https://axios-http.com/docs/instance), [configuration](https://axios-http.com/docs/req_config)).

Chaque forme a un exemple dans [tests/packs-http-client.test.ts](../../../tests/packs-http-client.test.ts). État : **lu**, **à faire**, **hors pack**.

Un appel HTTP sortant devient `http_call(Fichier, Méthode, Chemin, Ligne)`. L'assembleur le relie à la route d'un autre déployable qui a la même méthode et le même chemin. Un morceau calculé du chemin (`/bookings/${id}`) devient `:param`, comme dans une route.

## fetch

| # | Forme | Exemple | État |
|---|---|---|---|
| F1 | un chemin, GET par défaut | `fetch("/workshops")` | lu |
| F2 | la méthode dans les options | `fetch("/payments", { method: "POST" })` | lu |
| F3 | les options dans une variable | `const init = { method: "DELETE" }; fetch(url, init)` | lu |
| F4 | un chemin avec des morceaux calculés, une requête, une ancre | `` fetch(`/bookings/${id}?full=1`) `` → `/bookings/:param` | lu |
| F5 | une adresse de base devant le chemin | `` fetch(`${API_URL}/payments`) ``, `API_URL + "/payments"`, `new URL("/payments", base)` : le chemin est ce qui suit la base | lu |
| F6 | fetch nommé autrement | `globalThis.fetch(…)`, `window.fetch(…)` | lu |
| F7 | un objet `Request` | `fetch(new Request("/x", { method: "POST" }))` | lu |
| F8 | l'adresse dans une constante | `` const GEN_URL = `${BACKEND}/generate`; fetch(GEN_URL) `` | lu |
| F9 | une adresse qu'on ne sait pas lire | `fetch(url)` avec `url` reçue d'ailleurs, hors d'une enveloppe | non lu : compté comme chemin calculé (`path_dynamic`), et dit par le constat « route sans appel » |

## axios

| # | Forme | Exemple | État |
|---|---|---|---|
| X1 | une méthode par verbe | `axios.get("/x")`, `post`, `put`, `patch`, `delete`, `head`, `options` | lu |
| X2 | une configuration | `axios("/x")`, `axios({ url: "/x", method: "post" })`, `axios.request({ url, method })` | lu |
| X3 | axios importé sous un autre nom | `import http from "axios"; http.get("/x")`, `require("axios")` | lu |
| X4 | une instance | `const api = axios.create({ baseURL })`, puis `api.post("/x")` | lu |
| X5 | une instance importée d'un autre fichier, sous un autre nom, ou par un fichier qui ré-exporte | `import { api } from "./http"` | lu |
| X6 | une instance dont la base contient un chemin | `axios.create({ baseURL: "/api" })` puis `api.get("/x")` → `/api/x` | lu |

## Les enveloppes

Ces formes viennent du langage, pas de fetch ni d'axios ; elles valent pour les deux.

| # | Forme | Exemple | État |
|---|---|---|---|
| E1 | une fonction qui passe son paramètre dans l'adresse | `function api(path, init) { return fetch(BASE + path, init) }`, puis `api("/payments", { method: "POST" })` | lu |
| E2 | la méthode en paramètre | `function request(method, path) { return fetch(path, { method }) }`, puis `request("POST", "/x")` | lu |
| E3 | la méthode fixée par l'enveloppe | `const post = (path) => fetch(path, { method: "POST" })`, `(path) => api.post(path)` | lu |
| E4 | une enveloppe d'enveloppe | `const getJson = (p) => api(p)` | lu |
| E5 | une enveloppe importée d'un autre fichier | `import { api } from "./client"` | lu |
| E6 | des méthodes regroupées dans un objet | `export const api = { get: (p) => request("GET", p) }`, puis `api.get("/x")` | à faire |

## Ce que le pack ne prend pas pour un appel

| Forme | Pourquoi |
|---|---|
| `map.get("/x")`, `router.get("/x", …)` | un verbe sur un objet qui n'est ni axios, ni une instance d'axios |
| une fonction qui reçoit un chemin sans le passer à fetch ou axios | ce n'est pas une enveloppe |

## Hors pack, ou plus tard

| Forme | Pourquoi |
|---|---|
| une adresse complète écrite en dur (`fetch("https://api.github.com/x")`) | un service externe appelé sans SDK : à montrer comme nœud externe, à faire |
| un nom d'hôte interne (`http://api:3000/x`, un service Compose) | à faire : relier l'hôte au déployable du même nom |
| les clients générés (OpenAPI, tRPC), `ky`, `got`, `ofetch` | d'autres bibliothèques : d'autres packs |
| l'appel d'une enveloppe dont le chemin n'est pas lisible (`request(path)` avec `path` reçu d'ailleurs) | à faire : compter cet appel comme non lu |
