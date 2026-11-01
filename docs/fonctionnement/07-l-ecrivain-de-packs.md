# 7. L'écrivain de packs

Code : [vision/writer/](../../vision/writer/), [cli/pack.ts](../../cli/pack.ts), [vision/facts/registry.ts](../../vision/facts/registry.ts). Décision : [ADR 0019](../decisions/0019-packs-et-vues-evolutifs.md), §1.

## Le concept

Une technologie que les packs livrés ne lisent pas reste un trou dans la carte. L'écrivain de packs le comble sans qu'un humain écrive le pack : un agent le rédige à partir de la documentation de la technologie, VisionLayer le vérifie dans un domaine à part, et un humain l'accepte en voyant ce qu'il change à la carte.

VisionLayer ne remplace pas l'agent. Il prépare une **fiche**, que suit l'assistant Muse (Muse Spark, par la Responses API de Meta) ou tout autre assistant qui a les mêmes outils.

## La fiche

`packBrief` ([brief.ts](../../vision/writer/brief.ts)) écrit la fiche. Elle contient :

- **la mission et ses gardes** : la technologie, jamais un projet ; ce que la carte sait montrer, pas des appels de fonctions ; rien d'inventé ; pas de script ;
- **la marche à suivre** : l'inventaire, un test par forme et un test des faux amis, le pack, la vérification, la page de documentation ;
- **le format des packs** : `match`, `where`, `emit`, `rules`, `provides`, `requires`, `tests` ;
- **le vocabulaire de faits** ([vocabulary.ts](../../vision/writer/vocabulary.ts)) : ce qu'un pack peut lire, et les relations neutres qu'il peut produire pour que la carte change. Leur arité est vérifiée contre celle des packs livrés à chaque fiche ;
- **un pack local accepté**, en exemple ;
- **la documentation de la technologie** : son README et ses types dans `node_modules` (le paquet et `@types`), ou un fichier fourni avec `--doc`.

Du projet ouvert, la fiche ne prend que la version de la technologie, lue dans `package.json`. C'est la garde principale : un agent qui voit le projet voudrait faire passer *ce* projet, et taillerait le pack pour lui.

## Les outils de l'agent

Aucun ne lit le projet ([tools.ts](../../vision/writer/tools.ts)).

| Outil | Ce qu'il rend |
|---|---|
| `syntax_tree` | l'arbre que voit tree-sitter pour un exemple écrit par l'agent : un nœud par ligne, son champ, sa ligne, le texte des feuilles. Une requête écrite de mémoire se trompe souvent de nom de nœud |
| `check_pack` | les vérifications du registre (schéma sans script, `provides`, arités, cycles), puis chaque test dans un dossier à part avec les packs livrés ; pour chaque test : ce qui manque, ce qui sort à tort, et tous les faits produits |
| `submit_pack` | le pack final et sa page de documentation ; refusé tant que `check_pack` le refuse |

## Le parcours

```
pnpm packs write <paquet> [projet] [--doc fichier]
```

1. La fiche est écrite dans `.vision/packs/proposes/<paquet>.fiche.md`.
2. Muse Spark la suit. Chaque échange est affiché et gardé dans `<id>.steps.json`, avec les tokens et le coût.
3. Le pack rendu est déposé dans `.vision/packs/proposes/<id>.yaml`, avec sa page `<id>.md`. Le registre ne lit pas ce dossier : la carte acceptée ne change pas.
4. L'aperçu (`PackRegistry.preview`) essaie le pack sur une copie de la base de faits du projet, et rend ce qu'il ajoute ou retire à la carte (`<id>.changes.json`).
5. L'humain décide : `pnpm packs accept <id>` pose le pack dans `.vision/packs/`, d'où le registre le charge à chaud ; `pnpm packs reject <id>` le retire. Retiré, la carte redevient exactement celle d'avant (chapitre 3, ADR 0019).

`pnpm packs fiche <paquet>` écrit la fiche seule, pour un autre assistant.

## La confiance, sur la carte

Pour qu'un pack de session ou de jeton change la carte, l'assembleur lit une relation neutre de plus : `trust(Fichier, Mécanisme, Ligne)`. Elle dit comment un appelant prouve qui il est, là où le code lit cette preuve (`cookie`, `signed-cookie`, `token`, `signature`, `api-key`) : un outil monté ne suffit pas. Le mécanisme se pose sur la facette `trust` du bloc qui atteint ce fichier, et l'aperçu le montre (« api reconnaît ses appelants par signed-cookie »).

## Le premier essai : cookie-parser

Le 31/10/2026, sur une copie d'atelier-api, en trois essais (0,83 $ en tout). Le détail, la fiche et le pack sont dans [examples/pack-writer/cookie-parser](../../examples/pack-writer/cookie-parser/README.md).

- **Essai 1, faux.** Le pack passait ses tests, mais affirmait « signed-cookie » parce que `cookieParser(secret)` est monté, alors que le code lit `req.cookies` et pose un cookie non signé. Des tests verts ne suffisent pas : c'est l'aperçu sur le projet, devant un humain, qui l'a montré.
- **La fiche corrigée** (« installé n'est pas employé », « une valeur lue hors d'une garde peut n'être qu'une préférence »), les essais 2 et 3 sont justes sur atelier-api, et le troisième l'est aussi à l'aveugle sur OpenArchiver.
- **Limites du pack retenu** : la requête est reconnue par le nom `req` ou `request`, et la lecture n'est pas rattachée à une garde.

## Du « non lu » au lu : Meilisearch sur OpenArchiver (01/11)

Sur la carte d'OpenArchiver, Meilisearch, le moteur de recherche de l'app, était un bloc « image non lue » : trois programmes l'importaient, rien ne disait ce qu'ils en faisaient. C'est l'entrée de l'écrivain : la fiche est faite depuis le README et les types installés dans le paquet `backend` (la fiche cherche maintenant dans le `node_modules` de chaque paquet du dépôt).

**Premier essai, 0,41 $ : un pack juste pour la documentation, muet sur le projet.** Il ne lisait que les formes du README : `const client = new MeiliSearch()`, puis `client.index("films")`. OpenArchiver range le client dans un champ de classe (`this.client = new MeiliSearch()`) et reçoit le nom de l'index en paramètre, la forme courante d'un service qui enveloppe une bibliothèque. La fiche disait aussi : « ce qu'un lecteur statique ne peut pas trancher n'émet rien ». C'était contraire à notre règle : une carte qui se tait sur un appel réel ment autant qu'une carte qui invente.

**La fiche corrigée** demande d'émettre l'appel et l'emploi du service avec ce qui est écrit, et `unresolved(…, path_dynamic, …)` à la place d'un nom calculé ; et de ne pas faire dépendre un fait d'une chaîne de variables qu'un code enveloppé casse : une méthode propre à la technologie appelée dans un fichier qui l'importe suffit.

**Second essai, 0,33 $, 8 échanges :** le bloc Meilisearch est lu (le client à `SearchService.ts:9`), le serveur, le worker d'indexation et celui d'ingestion l'appellent (à partir de `SearchService.ts:33`), et les 5 noms d'index passés en paramètre sont comptés comme chemins calculés. Meilisearch n'est plus un pack manquant : un pack couvre la technologie qui porte son identifiant.
