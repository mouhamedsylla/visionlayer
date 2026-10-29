# Comment VisionLayer fonctionne

Cette documentation décrit **le fonctionnement de VisionLayer lui-même** : ses parties, ses mécanismes, ses formats, ses règles. Elle sera publiée dans la partie « Documentation » du site, avec les schémas du design system ; ces fichiers en sont la source.

## Les chapitres

| | Chapitre | État |
|---|---|---|
| 1 | [Vue d'ensemble](./01-vue-d-ensemble.md) : les parties de VisionLayer, ce qu'elles lisent et écrivent | écrit |
| 2 | [La base de faits](./02-la-base-de-faits.md) : faits, lecteurs, cache par fichier | écrit |
| 3 | [Les packs](./03-les-packs.md) : le format, référence complète | écrit |
| 4 | [Le moteur de règles](./04-le-moteur-de-regles.md) : syntaxe, évaluation, preuves | écrit |
| 5 | [Le modèle neutre et l'assembleur](./05-le-modele-neutre.md) : du résultat des règles à la carte | écrit |
| 6 | [Ce qu'on sait faire, et comment on le vérifie](./06-limites-et-verification.md) | écrit |
| 7 | Les niveaux de lecture actuels : structure du code, technologies, infrastructure (la carte version 1 n'aura pas de chapitre : elle part avec l'interface actuelle) | à écrire |
| 8 | Les déroulés de features et les contrats, refaits sur la base de faits | à écrire |
| 9 | L'interface recodée depuis les maquettes : serveur local, lectures du modèle neutre, actions sur clic | à écrire |
| 10 | Le serveur MCP et le contexte des agents | à écrire |
| 11 | La connaissance déclarée et l'activité des agents | à écrire |

## Règles d'écriture

1. **Le mécanisme d'abord.** Chaque chapitre explique un concept de VisionLayer et le code qui le réalise. Un exemple vient ensuite, pour montrer, jamais comme fil conducteur.
2. **Le code cité.** Chaque mécanisme renvoie au fichier qui l'implémente et à la décision (ADR) qui l'a choisi.
3. **L'état réel, daté.** Ce qui marche est dit avec le projet où ça a été vérifié ; ce qui ne marche pas encore est dit aussi.
4. **Mis à jour avec le code.** Une modification d'un mécanisme décrit ici met à jour son chapitre dans le même commit.

## Les constats

[Les constats](constats.md) : chaque détecteur, ce qui le déclenche, ce qui le fait taire, et son état.

## Inventaires des packs

Pour chaque technologie, la liste des formes de son API documentée, avec leur état (lu, à faire, hors pack) :

- [Express](packs/express.md)
- [Drizzle ORM](packs/drizzle.md)
- [BullMQ](packs/bullmq.md)
- [node-cron](packs/node-cron.md)
- [SDK : Stripe, Resend, nodemailer](packs/sdk.md)
- [Zod pour l'environnement](packs/zod-env.md)
- [fetch et axios](packs/http-client.md)
- [Dockerfile](packs/docker.md)
- [Docker Compose](packs/compose.md)
- [Fly.io](packs/fly.md)
- [Vite et React](packs/vite-react.md)
- [Stockages](packs/stores.md)
- [Journaux : console, pino, winston](packs/logs.md)
