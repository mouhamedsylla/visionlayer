# example-voting-app : premier lancement

Oracle commité avant le lancement (`50875c7`). Lancé le 02/10/2026 au commit de VisionLayer qui suit ce fichier, par `vision facts checkout --oracle expected.arch.json`. Aucun pack modifié.

| Mesure | Valeur |
|---|---|
| Trouvé | 8 sur 39 |
| En plus | 1, relu : vrai (oubli de l'oracle) |
| Faux | 0 |
| Non lu (dit par la couverture) | 15 |
| Manqué sans le dire | 16 |

## Ce qui est trouvé

Le service `result` (Node, Express) et sa route `GET /`, la base `db` et `redis`, la variable `PORT`, et la connexion Postgres sans délai (`missing_timeout`, `result/server.js:20`).

## En plus, relu à la main

- `result http GET /*` : vrai. `app.use(express.static(__dirname + '/views'))` sert le dossier `views`. L'oracle l'avait oublié.

## Non lu : la couverture le dit

Les fichiers `.py` (2) et `.cs` (1) sont déclarés non lus. Ce qu'ils portent est donc compté non lu : les routes de `vote`, le worker C#, la file `votes`, la table `votes` (créée par le worker), `OPTION_A` et `OPTION_B`.

## Manqué sans le dire

| Ce qui manque | Pourquoi | Forme documentée ? |
|---|---|---|
| les nœuds `vote`, `worker`, `seed` | docker-compose les déclare (`build: ./vote`…), mais un service dont le code n'est pas lu ne devient pas un nœud | oui : un service Compose avec `build` est un déployable, même si son langage n'est pas lu ; il devrait apparaître, marqué non lu |
| `vote ×2`, `worker ×2` | `deploy.replicas: 2` dans `docker-stack.yml` n'est pas lu | oui : `deploy.replicas` est dans la spécification Compose |
| `result read db (votes)` | la requête passe par le client reçu en rappel : `pool.connect(function (err, client) { … client.query('SELECT … FROM votes') })` | oui : `pool.connect(callback)` est une forme documentée de node-postgres |
| les évènements socket.io `connection` et `subscribe`, et l'app navigateur `result/views` | socket.io n'a pas de pack, et rien ne le dit | à décider : socket.io devrait au moins compter comme technologie sans pack |
| `seed call vote` | l'appel est fait par `ab` dans un script shell | non : un script shell n'est pas lu ; il devrait compter comme non lu |

## Correction de l'outil de mesure

Le premier passage appariait un même nœud trouvé (`result`) à deux nœuds de l'oracle (`vote` et `result`, qui ont tous deux `GET /`), et annonçait 4 nœuds trouvés. L'appariement est maintenant un à un ; les chiffres ci-dessus viennent de la version corrigée.
