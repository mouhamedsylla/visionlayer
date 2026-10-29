# Le corpus

Deux ensembles, jamais mélangés ([fonctionnement, chapitre 6](../../docs/fonctionnement/06-limites-et-verification.md#comment-on-vérifie)).

## Apprentissage

Les projets avec lesquels on construit les packs. On peut les lire autant qu'on veut, et ajuster un pack pour une forme qu'ils emploient, à condition que cette forme soit documentée par la technologie.

- [atelier-api](atelier-api) : Express, Drizzle, Postgres, BullMQ, node-cron, Stripe, Resend, Vite et React, Docker, Compose, Fly.io.
- Nafar, une application de l'auteur, hors du dépôt.

## Contrôle

Un projet de contrôle reste **dans la pile qu'on gère**, celle d'atelier-api : Express, Drizzle ou pg, Postgres, BullMQ et Redis, node-cron, Stripe, Resend ou nodemailer, Vite et React, Docker, Compose, Fly.io. Le contrôle cherche les limites réelles des packs existants ; il ne sert pas à découvrir des technologies qu'on n'a pas prévu de lire. Une technologie hors de cette pile peut apparaître dans un projet, mais elle doit seulement être déclarée « sans pack », et ce qu'elle porte compte non lu.

Les projets qui servent à juger, dans [controle/](controle) :

- [example-voting-app](controle/example-voting-app) (dockersamples, Apache-2.0)
- [node-express-boilerplate](controle/node-express-boilerplate) (hagopj13, MIT)
- [openarchiver](controle/openarchiver) (LogicLabs-OU, AGPL-3.0)

Ces trois premiers projets sortent en partie de la pile (Python, C#, Mongoose, Meilisearch, socket.io) : ils ont été mal choisis. Leurs limites dans la pile sont corrigées, test d'abord (RYP-224) ; ils passent alors dans l'apprentissage, et trois nouveaux projets de contrôle, dans la pile, les remplacent.

Premier lancement le 02/10/2026 ; les mesures sont dans chaque `resultat.md` et au [chapitre 6](../../docs/fonctionnement/06-limites-et-verification.md#le-premier-contrôle-à-laveugle-02102026). Pour cloner le code au bon commit :

```bash
git clone https://github.com/<dépôt>.git checkout && git -C checkout checkout <commit>
```

Chacun a son dossier :

| Fichier | Contenu |
|---|---|
| `source.json` | le dépôt d'origine, le commit exact, la licence, la date d'ajout |
| `expected.arch.json` | l'oracle, écrit à la main en lisant le code, **commité avant le premier lancement** de VisionLayer |
| `resultat.md` | les mesures du premier lancement (trouvé, en plus relu à la main, non lu, manqué), publiées bonnes ou mauvaises |
| `checkout/` | le code, cloné au commit de `source.json` ; jamais commité (code d'un tiers) |

Les règles :

1. L'oracle est commité avant le premier `vision facts --score`. Le commit de l'oracle précède celui du résultat ; l'historique Git en fait foi.
2. Aucun pack n'est modifié pour un projet de contrôle avant que son résultat soit publié.
3. Un projet de contrôle raté puis corrigé passe dans l'apprentissage. Il faut alors un nouveau projet de contrôle.
