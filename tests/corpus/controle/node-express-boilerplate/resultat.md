# node-express-boilerplate : premier lancement

Oracle commité avant le lancement (`e444c7a`). Lancé le 02/10/2026. Aucun pack modifié.

| Mesure | Valeur |
|---|---|
| Trouvé | 2 sur 55 |
| En plus | 0 |
| Faux | 0 |
| Non lu (dit par la couverture) | 0 |
| Manqué sans le dire | 53 |

C'est le pire cas : la couverture annonce 51 fichiers lus sur 51 et 5 manifestes sur 5, et la carte est presque vide.

## Ce qui est trouvé

Le serveur SMTP (nodemailer, `src/services/email.service.js:5`) et le stockage `mongodb` (docker-compose).

## Manqué sans le dire

| Ce qui manque | Pourquoi | Forme documentée ? |
|---|---|---|
| le déployable `app`, donc ses 14 routes, leur code, ses 13 variables et ses liens | le `Dockerfile` n'a pas de `CMD`. Le lancement est dans `docker-compose.prod.yml` (`command: yarn start`), puis `package.json` (`pm2 start ecosystem.config.json`), puis `ecosystem.config.json` (`"script": "src/index.js"`) | en partie : `command` d'un fichier Compose et un script de `package.json` sont des formes documentées ; pm2 est une autre technologie, qui devrait compter comme non lue |
| les routes, même une fois le déployable trouvé | elles sont montées sous `/v1` par une boucle : `defaultRoutes.forEach((route) => router.use(route.path, route.route))` | à vérifier dans l'inventaire Express : le montage est documenté, la boucle sur un tableau est propre au projet |
| les collections `users` et `tokens`, et les lectures et écritures | Mongoose n'a pas de pack, et il n'apparaît pas non plus comme technologie sans pack | Mongoose devrait au moins être déclaré sans pack : c'est un trou de la couverture |
| les variables d'environnement | elles sont lues par un schéma Joi validé contre `process.env` (`envVarsSchema.validate(process.env)`) | non : c'est une façon d'écrire propre à Joi ; sans pack Joi, elles devraient compter comme non lues |
