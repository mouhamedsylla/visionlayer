# Inventaire : journaux (console, pino, winston)

Pack : [vision/packs/logs.yaml](../../../vision/packs/logs.yaml). Sources : la [console de Node.js](https://nodejs.org/api/console.html), la documentation de [pino](https://getpino.io/#/docs/api) ([enfants](https://getpino.io/#/docs/child-loggers), [masquage](https://getpino.io/#/docs/redaction)) et de [winston](https://github.com/winstonjs/winston#usage).

Chaque forme a un exemple dans [tests/packs-logs.test.ts](../../../tests/packs-logs.test.ts). État : **lu**, **à faire**, **hors pack**.

Le pack ne dessine rien dans la carte. Il sert au constat `personal_data_logged` ([Les constats](../constats.md)) : il dit ce qui est écrit dans un journal.

## Écrire dans un journal

| # | Forme | Exemple | État |
|---|---|---|---|
| J1 | la console | `console.log(…)`, `info`, `warn`, `error`, `debug`, `trace` | lu |
| J2 | un journal pino | `import pino from "pino"; const logger = pino({ level })`, `import { pino } from "pino"`, `require("pino")()` ; puis `logger.info(obj, msg)`, `trace`, `debug`, `warn`, `error`, `fatal` | lu |
| J3 | un journal winston | `winston.createLogger({ … })`, `import { createLogger } from "winston"` ; puis `logger.info(…)`, `logger.log("info", …)` | lu |
| J4 | un journal enfant | `const log = logger.child({ module: "auth" })` | lu |
| J5 | un journal exporté, puis importé ailleurs | `export const logger = pino()`, `import { logger } from "./logger"`, ré-exports compris | lu |

## Ce qui est écrit

On regarde chaque argument : un objet (ses clés et ses valeurs), une variable, un membre (`user.email`), les morceaux calculés d'un gabarit (`` `inscrit : ${user.email}` ``). Rien de plus profond : `{ count: users.filter((u) => u.email).length }` n'écrit pas d'email.

| # | Forme | Exemple | État |
|---|---|---|---|
| W1 | le corps entier d'une requête HTTP | `logger.info({ body: req.body })` dans le code d'une route : `req` est le premier paramètre de la fonction | lu |
| W2 | un champ nommé comme une donnée personnelle | `{ email }`, `{ userEmail: u.email }`, `console.log(user.phone)`, `` `${input.password}` `` : un mot du nom parmi `email`, `mail`, `password`, `passwd`, `phone`, `telephone`, `address`, `birthdate`, `birthday`, `ssn`, `iban` ; sauf quand le dernier mot dit que ce n'est pas la valeur (`emailId`, `phoneVerified`, `mailCount` : un identifiant, un état, un nombre) | lu |
| W3 | un journal qui masque des champs | `pino({ redact: ["req.body.password"] })` | lu : rien n'est affirmé pour ce journal |

## Hors pack, ou plus tard

| Forme | Pourquoi |
|---|---|
| `pino-http`, `morgan` (journal de chaque requête) | à faire : ils écrivent l'adresse et les en-têtes, pas le corps, par défaut |
| les formats winston qui masquent (`format((info) => …)`) | à faire : un masquage écrit dans une fonction ; aujourd'hui, rien n'est masqué |
| `debug`, `bunyan`, `loglevel`, `consola` | d'autres bibliothèques : à ajouter forme par forme |
| un champ personnel nommé autrement (`nom`, `courriel`) | la liste des mots est en anglais ; un nom qui n'y est pas n'est pas vu |
