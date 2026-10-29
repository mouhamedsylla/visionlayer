# OpenArchiver : premier lancement

Oracle commité avant le lancement (`62aa944`). Lancé le 02/10/2026. Aucun pack modifié. Méthode et portée de l'oracle : [source.json](source.json).

| Mesure | Valeur |
|---|---|
| Trouvé | 24 sur 406 |
| En plus | 10, relus : 9 vrais, 1 faux |
| Faux | 1 |
| Non lu (dit par la couverture) | 29 |
| Manqué sans le dire | 353 |

## Ce qui est trouvé

Postgres et ses 23 tables Drizzle.

## En plus, relu à la main

| Élément | Verdict |
|---|---|
| le nœud `valkey` et ses 3 files (`ingestion`, `indexing`, `compliance-lifecycle`) | vrais. Le nœud est étiqueté `redis` alors que l'image est `valkey/valkey` (compatible Redis) ; faute de technologie commune avec l'oracle, l'outil ne les apparie pas, et les compte à la fois en plus et manqués |
| le contrat `IEmailConnector` et ses implémentations | vrai, absent de l'oracle |
| `unused_value` : `retention_policies.actionOnExpiry` (`delete_permanently`, `notify_admin`), `journaling_sources.status` (`paused`) | vrais : aucun code de ce dépôt n'écrit ces tables. Elles sont écrites par le module entreprise, qui n'est pas dans le dépôt |
| `Serveur SMTP` (nodemailer, `helpers/emlUtils.ts:199`) | **faux** : le code n'importe que `nodemailer/lib/mail-composer`, pour construire un fichier EML en mémoire ; rien n'est envoyé |

## Non lu : la couverture le dit

AWS, Google Cloud et Microsoft Azure sont déclarés sans pack. Les liens vers S3, Google et Microsoft sont donc non lus. Attention : 16 constats `personal_data_logged` sont aussi comptés non lus, parce qu'ils sont dans des fichiers que la couverture désigne pour un import de SDK. La couverture ne dit rien des journaux ; cette mesure, faite fichier par fichier, est généreuse.

## Manqué sans le dire

| Ce qui manque | Pourquoi | Forme documentée ? |
|---|---|---|
| les 6 processus (`api`, `frontend`, les deux workers, le planificateur, les migrations), donc les 78 points d'entrée, les 48 variables et presque tous les liens | ils sont lancés par `pnpm docker-start:oss`, qui appelle `concurrently` avec les scripts `start:oss` et `start:workers` de `package.json`. Le `Dockerfile` lance `CMD ["pnpm", "docker-start:oss"]` après un `ENTRYPOINT` shell | en partie : un `CMD` qui appelle un script de `package.json` est une forme documentée ; `concurrently` est un outil sans pack, qui devrait compter comme non lu |
| `meilisearch.emails` et les accès à Meilisearch, Tika | pas de pack pour Meilisearch ni pour Tika, et rien ne le dit | Meilisearch devrait au moins être déclaré sans pack |
| les 9 routes jamais appelées | sans routes lues, rien à comparer | dépend du premier point |
| 11 des 27 champs `userEmail` et `mailbox` écrits dans le journal pino (les 16 autres sont comptés non lus, voir plus haut) | le journal a une option `redact: ['password']` ; le pack ne dit rien d'un journal qui masque, même si le champ écrit n'est pas masqué | oui : `redact` ne masque que les chemins qu'il nomme (documentation pino) ; c'est la règle du pack qui est trop large |
