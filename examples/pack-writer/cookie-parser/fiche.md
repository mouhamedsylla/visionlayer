# Fiche : écrire le pack de `cookie-parser` (version ^1.4.7)

Tu écris un pack pour VisionLayer, un lecteur statique de code qui dessine la carte d'un système : ses programmes, leurs portes d'entrée, leurs données, leurs liens, et comment un appelant prouve qui il est. Un pack dit ce que veut dire une technologie, comme des données : des motifs de l'arbre syntaxique qui émettent des faits, et des règles qui les joignent.

## Ce qui compte

- **La technologie, jamais un projet.** Tu ne vois aucun projet, et c'est voulu. Tout vient de la documentation ci-dessous. N'invente aucune API qu'elle ne montre pas.
- **Ce que la carte sait montrer.** Un pack qui décrit des appels de fonctions ne change rien. Demande-toi ce que la technologie change au programme qui l'emploie : une porte d'entrée, une lecture de données, un appel sortant, une façon de reconnaître l'appelant. Puis exprime-le avec le vocabulaire plus bas.
- **Installé n'est pas employé.** Monter ou configurer la technologie ne dit pas ce que le code fait de ce qu'elle fournit. Un fait se fonde sur la ligne qui emploie vraiment ce qu'elle apporte. Écris aussi le test où elle est montée mais ce qu'elle fournit n'est jamais lu, ou lu autrement que la documentation le demande.
- **Rien d'inventé.** Ce qu'un lecteur statique ne peut pas trancher (une valeur calculée à l'exécution) n'émet rien. Écris-le dans la page de documentation, colonne « non lu ».
- **Pas de script.** Un pack écrit par un agent n'a droit qu'à des requêtes et des règles.

## La marche à suivre

1. **L'inventaire** : chaque forme de l'API documentée qui change ce que fait un programme, avec un exemple de code tel qu'un projet l'écrirait.
2. **Un test par forme** : un petit dépôt de un ou deux fichiers, les faits attendus, et au moins un test des faux amis (le même nom de méthode sur un objet qui ne vient pas de `cookie-parser`), avec les faits qui ne doivent pas sortir.
3. **Le pack**. Avant d'écrire une requête, appelle `syntax_tree` sur l'exemple : il rend l'arbre exact que voit tree-sitter. Une requête écrite de mémoire se trompe souvent de nom de nœud.
4. **`check_pack`** jusqu'à ce que tout passe. Il vérifie le schéma, ce que le pack déclare, puis lance chaque test à part avec les packs livrés, et te rend pour chaque test ce qui manque, ce qui sort à tort, et tous les faits produits.
5. **`submit_pack`** avec le pack et sa page de documentation en français : le tableau des formes (numéro, forme, exemple, état : lu ou non lu, et pourquoi).

## Le format d'un pack

```yaml
id: cookie-parser                       # minuscules, chiffres, tirets ; ce ne peut pas être celui d'un pack livré
name: cookie-parser
languages: [javascript, typescript]
when: { imports: [cookie-parser] }     # facultatif : le pack ne s'ouvre que dans les fichiers qui importent ce paquet
provides: [cookie_parser_form1]   # TOUTES les relations qu'il produit, émissions et têtes de règles, neutres comprises
requires: []                    # les relations d'autres packs qu'il lit (entrypoint, handler_at…), s'il en lit
match:
  - id: forme-1
    query: |                    # une requête tree-sitter, syntaxe standard ; pas de prédicats #eq? ni #match? : filtre dans where
      (call_expression function: (identifier) @fn arguments: (arguments) @args) @call
    where:                      # filtres sur les captures, évalués par VisionLayer
      fn: { import_of: cookie-parser }
    at: call                    # la capture dont la ligne prouve le fait
    emit: cookie_parser_form1($file, @fn, $line)
rules: |
  % une règle Datalog par ligne ; % commente. Ici, une relation neutre du vocabulaire, déduite de la forme :
  % relation_neutre(F, …, L) :- cookie_parser_form1(F, _, L).
tests:
  - name: F1 la forme documentée
    files:
      app.ts: |
        import x from "cookie-parser";
        …
    expect: ['cookie_parser_form1("app.ts", "x", _)']   # _ vaut n'importe quoi
    absent: []
```

Sans `when`, le pack s'ouvre dans tous les fichiers JavaScript et TypeScript : c'est utile quand la forme à lire est écrite dans un fichier qui n'importe pas le paquet (une valeur que le paquet a posée sur un objet, lue plus loin). Les règles sont globales : elles joignent les faits de tous les fichiers.

### `where`

| Forme | Vrai si la capture… |
|---|---|
| `[a, b]` ou `{ any: [a, b] }` | vaut `a` ou `b` |
| `{ not: [a, b] }` | ne vaut ni `a` ni `b` |
| `{ match: "^[A-Z_]+$" }` | correspond à l'expression |
| `{ import_of: paquet }` | est un nom importé de ce paquet (`import cp from "cookie-parser"`, `const cp = require("cookie-parser")`) |
| `{ bound_to: paquet }` | est une variable créée par un appel à ce que fournit le paquet : `const app = express()` |

La valeur d'une capture est celle d'une chaîne littérale si c'en est une, sinon le texte du code.

### `emit`

Une émission ou une liste, `relation(arg, …)`. Une émission dont un argument manque ne produit rien.

| Argument | Valeur |
|---|---|
| `$file`, `$line` | le fichier, la ligne de la preuve |
| `@nom` | la valeur de la capture |
| `@nom:raw`, `@nom:upper`, `@nom:lower` | son texte brut, en majuscules, en minuscules |
| `@nom:symbol`, `@nom:line` | le nom de la fonction appelée (enveloppes retirées), sa ligne |
| `@nom:pkg` | le paquet d'où vient ce nom importé |
| `"texte {nom}"` | un gabarit |
| `mot`, `"chaîne"`, `42` | une constante |

### `rules`

- Une variable commence par une majuscule ou `_` ; `_` seul ne lie rien.
- Une constante : une chaîne entre guillemets, un nombre, un mot en minuscules.
- `not r(…)` : négation ; ses variables doivent être liées ailleurs dans le corps.
- `X != Y`, `X = Y`, `L1 < L2` : comparaisons ; `P = cat(A, "/", B)` colle des chaînes.

## Le vocabulaire de faits

### Ce qu'un pack peut lire

Les faits de la syntaxe, lus sans aucun pack, et ceux du cœur. Une règle peut les joindre.

- `import_raw(Fichier, Local, Spécificateur, Importé)` : un import tel qu'écrit. Exemple : `import cron from "node-cron" → import_raw("jobs.ts", "cron", "node-cron", "default")`.
- `imports(Fichier, Local, FichierCible, Importé)` : un import résolu vers un fichier du dépôt.
- `defines(Fichier, Nom, Ligne)` : function f, const f = …, class C.
- `export_fn(Fichier, Nom, Ligne)` : une fonction exportée.
- `fn_span(Fichier, Nom, Début, Fin)` : les lignes d'une fonction de premier niveau.
- `member_call(Fichier, Racine, Chemin, Ligne)` : un appel sur une valeur. Exemple : `stripe.paymentIntents.create(…) → member_call(F, "stripe", "paymentIntents.create", L)`.
- `env(Fichier, Nom)` : une variable d'environnement lue (process.env.NOM).
- `entrypoint(Fichier, Genre, Clé, Fonction, Ligne)` : un point d'entrée déjà lu par un autre pack (une route Express…).
- `entry_guard(Fichier, Ligne, Niveau, FichierGarde, LigneGarde)` : la garde du point d'entrée déclaré à Fichier:Ligne : la fonction du dépôt qui refuse l'appelant, écrite à FichierGarde:LigneGarde ; Niveau vaut auth (elle répond 401 : l'appelant n'est pas reconnu) ou role (403). La lire demande requires: [entry_guard].
- `handler_at(Fichier, Clé, FichierCode, LigneCode)` : où est écrit le code d'un point d'entrée.
- `reach(FichierLancé, Fichier)` : les fichiers qu'un programme lancé atteint par ses imports.

### Ce qu'un pack peut produire pour que la carte change

Les relations neutres que lit l'assembleur de la carte. Un pack peut aussi produire des relations internes, préfixées par son identifiant (`node_schedule_job` pour `node-schedule`), que ses règles joignent ensuite ; elles n'apparaissent pas sur la carte.

- `entrypoint(Fichier, Genre, Clé, Fonction, Ligne)` : une porte d'entrée dans le programme. Genre : http, rpc, event, message, schedule, cli. La carte la montre dans son bloc, et suit ce que son code exécute. Exemple : `entrypoint("jobs.ts", "schedule", "0 8 * * *", "sendDigest", 3)`.
- `trust(Fichier, Mécanisme, Ligne)` : là où le code lit la preuve qu'un appelant présente pour être reconnu : le cookie qu'il lit pour retrouver l'appelant, le jeton qu'il vérifie. Un outil monté ou configuré ne suffit pas : sans lecture de la preuve, aucun fait. Une valeur lue ailleurs que dans une garde peut n'être qu'une préférence (un thème, une langue) : la preuve d'identité est celle que lit une garde (entry_guard), la fonction qui refuse l'appelant quand elle manque. Mécanisme : cookie (un cookie lu tel qu'il arrive), signed-cookie (un cookie dont la signature est vérifiée à la lecture), token, signature, api-key. La carte le montre sur le bloc qui atteint ce fichier. Exemple : `trust("auth.ts", "token", 12)`.
- `accesses(Fichier, Op, Tech, Entité, Ligne)` : une lecture (read) ou une écriture (write) d'une entité d'un stockage. Exemple : `accesses("repo.ts", "write", "postgresql", "users", 12)`.
- `entity_seen(Tech, Forme, Entité, Fichier)` : une entité vue à l'usage (relational, document, key-value).
- `uses_store(Fichier, Tech)` : le code ouvre une connexion à ce stockage, à cette ligne.
- `publishes(Fichier, Topic)` : le code publie un message sur ce topic ou cette file.
- `subscribes(Fichier, Topic)` : le code consomme ce topic ou cette file.
- `external_pkg(Paquet, Tech, Nom)` : ce paquet est le client d'un service externe.
- `client(Fichier, Paquet)` : un client de service externe est construit dans ce fichier.
- `calls_external(Fichier, Paquet, Ligne)` : un appel au service externe.
- `inbound_from(Fichier, Paquet, Ligne)` : le code vérifie la signature d'un appel entrant de ce service.
- `env_read(Fichier, Nom, Ligne)` : une variable de configuration lue à cette ligne.
- `env_required(Fichier, Nom, yes|no)` : la variable est obligatoire ou non, d'après le code.
- `unresolved(Fichier, Genre, Ligne)` : reconnu sans pouvoir le relier : un trou de couverture (path_dynamic, target_unknown).

## Un pack local accepté, en exemple

```yaml
id: node-schedule
name: node-schedule
languages: [javascript, typescript]
when: { imports: [node-schedule] }
provides: [entrypoint]
match:
  - id: S1
    query: |
      (call_expression
        function: (member_expression object: (identifier) @obj property: (property_identifier) @method)
        arguments: (arguments . (string (string_fragment) @expr) . (identifier) @fn)) @call
    where:
      obj: { import_of: node-schedule }
      method: [scheduleJob]
    at: call
    emit: entrypoint($file, schedule, @expr, @fn, @fn:line)
tests:
  - name: S1 une tâche par scheduleJob
    files:
      jobs.ts: |
        import schedule from "node-schedule";
        function sendDigest() {}
        schedule.scheduleJob("0 8 * * *", sendDigest);
    expect: ['entrypoint(jobs.ts, schedule, "0 8 * * *", sendDigest, _)']
  - name: S2 un autre objet n'est pas une tâche
    files:
      jobs.ts: |
        const schedule = { scheduleJob(_e: string, _f: () => void) {} };
        function x() {}
        schedule.scheduleJob("* * * * *", x);
    absent: ['entrypoint(jobs.ts, schedule, _, _, _)']
```

## La documentation de `cookie-parser`

### docs/cookie-parser.md

# cookie-parser

[![NPM Version][npm-version-image]][npm-url]
[![NPM Downloads][npm-downloads-image]][npm-url]
[![Build Status][ci-image]][ci-url]
[![Test Coverage][coveralls-image]][coveralls-url]

Parse `Cookie` header and populate `req.cookies` with an object keyed by the
cookie names. Optionally you may enable signed cookie support by passing a
`secret` string, which assigns `req.secret` so it may be used by other
middleware.

## Installation

```sh
$ npm install cookie-parser
```

## API

```js
var cookieParser = require('cookie-parser')
```

### cookieParser(secret, options)

Create a new cookie parser middleware function using the given `secret` and
`options`.

- `secret` a string or array used for signing cookies. This is optional and if
  not specified, will not parse signed cookies. If a string is provided, this
  is used as the secret. If an array is provided, an attempt will be made to
  unsign the cookie with each secret in order.
- `options` an object that is passed to `cookie.parse` as the second option. See
  [cookie](https://www.npmjs.org/package/cookie) for more information.
  - `decode` a function to decode the value of the cookie

The middleware will parse the `Cookie` header on the request and expose the
cookie data as the property `req.cookies` and, if a `secret` was provided, as
the property `req.signedCookies`. These properties are name value pairs of the
cookie name to cookie value.

When `secret` is provided, this module will unsign and validate any signed cookie
values and move those name value pairs from `req.cookies` into `req.signedCookies`.
A signed cookie is a cookie that has a value prefixed with `s:`. Signed cookies
that fail signature validation will have the value `false` instead of the tampered
value.

In addition, this module supports special "JSON cookies". These are cookie where
the value is prefixed with `j:`. When these values are encountered, the value will
be exposed as the result of `JSON.parse`. If parsing fails, the original value will
remain.

### cookieParser.JSONCookie(str)

Parse a cookie value as a JSON cookie. This will return the parsed JSON value
if it was a JSON cookie, otherwise, it will return the passed value.

### cookieParser.JSONCookies(cookies)

Given an object, this will iterate over the keys and call `JSONCookie` on each
value, replacing the original value with the parsed value. This returns the
same object that was passed in.

### cookieParser.signedCookie(str, secret)

Parse a cookie value as a signed cookie. This will return the parsed unsigned
value if it was a signed cookie and the signature was valid. If the value was
not signed, the original value is returned. If the value was signed but the
signature could not be validated, `false` is returned.

The `secret` argument can be an array or string. If a string is provided, this
is used as the secret. If an array is provided, an attempt will be made to
unsign the cookie with each secret in order.

### cookieParser.signedCookies(cookies, secret)

Given an object, this will iterate over the keys and check if any value is a
signed cookie. If it is a signed cookie and the signature is valid, the key
will be deleted from the object and added to the new object that is returned.

The `secret` argument can be an array or string. If a string is provided, this
is used as the secret. If an array is provided, an attempt will be made to
unsign the cookie with each secret in order.

## Example

```js
var express = require('express')
var cookieParser = require('cookie-parser')

var app = express()
app.use(cookieParser())

app.get('/', function (req, res) {
  // Cookies that have not been signed
  console.log('Cookies: ', req.cookies)

  // Cookies that have been signed
  console.log('Signed Cookies: ', req.signedCookies)
})

app.listen(8080)

// curl command that sends an HTTP request with two cookies
// curl http://127.0.0.1:8080 --cookie "Cho=Kim;Greet=Hello"
```

## License

[MIT](LICENSE)

[ci-image]: https://badgen.net/github/checks/expressjs/cookie-parser/master?label=ci
[ci-url]: https://github.com/expressjs/cookie-parser/actions?query=workflow%3Aci
[coveralls-image]: https://badgen.net/coveralls/c/github/expressjs/cookie-parser/master
[coveralls-url]: https://coveralls.io/r/expressjs/cookie-parser?branch=master
[npm-downloads-image]: https://badgen.net/npm/dm/cookie-parser
[npm-url]: https://npmjs.org/package/cookie-parser
[npm-version-image]: https://badgen.net/npm/v/cookie-parser

