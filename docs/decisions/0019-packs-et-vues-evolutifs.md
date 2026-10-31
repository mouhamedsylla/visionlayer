# ADR 0019 — Des packs et des vues écrits par des agents, chargés et retirés à chaud

**Statut :** Proposée le 02/10/2026. Étapes 1 à 4 codées le 31/10/2026 pour les packs (`vision/facts/registry.ts`) ; les vues, l'écran Packs et la fiche de l'agent restent à faire. S'appuie sur l'[ADR 0013](./0013-visionlayer-control-tower-and-agent-integration.md) (VisionLayer lance l'assistant installé, n'orchestre pas d'agents), l'[ADR 0017](./0017-modele-neutre.md) (modèle neutre) et l'[ADR 0018](./0018-nouvelle-interface.md) (nouvelle interface).

Référence : Shi, Zhang, Cui, *A Programming Paradigm for Spatiotemporal Composability*, Peking University et DeepSeek-AI, août 2026 ([arXiv 2608.25512](https://arxiv.org/abs/2608.25512), code : [Cordis](https://github.com/cordiverse/paper)). Les numéros de section entre parenthèses (§3.1…) renvoient à ce papier.

## Contexte

Un pack est l'unité qui saisit une technologie : ce que veut dire `app.post(…)` pour Express, `.set({ status: "paid" })` pour Drizzle. Aujourd'hui, on écrit chaque pack à la main en suivant toujours la même recette : l'API documentée de la technologie, l'inventaire de ses formes (le tableau C1…C9, W1…W6 de [packs/drizzle.md](../fonctionnement/packs/drizzle.md)), un test par forme, puis le pack. Le cycle de vie de `bookings` montre où cette méthode s'arrête. VisionLayer lit chaque valeur écrite dans `status`, mais pas l'état d'où part une écriture (forme W6, « à faire »). Combler ce manque, c'est encore du travail à la main.

Cette recette, un agent peut la suivre. L'utilisateur propose donc :
- quand VisionLayer démarre sur un projet, ou quand une lecture se révèle fausse, un agent spécialisé écrit ou corrige le pack ;
- VisionLayer le charge à chaud, sans redémarrer ;
- l'interface évolue de la même manière, par des agents, avec moins de libertés.

Les packs écrits ainsi restent **locaux au projet**. Une place de partage pourra venir ensuite.

Charger et retirer à chaud du code écrit par une machine pose les deux problèmes que le papier nomme :
- retirer un composant doit défaire tout ce qu'il a fait (composabilité **temporelle**) ;
- un composant doit dire de quoi il dépend, et s'allumer ou s'éteindre quand cela apparaît ou disparaît (composabilité **spatiale**).

Le papier cite les *harnais d'agents qui se modifient eux-mêmes* comme cas d'usage (§1.2.2) ; le DeepSeek Harness est présenté comme bâti sur Cordis. Nous n'avons pas lu son code, et rien ici ne prétend le reproduire : on reprend les principes du papier, à notre échelle.

## Les principes du papier, et ce qu'ils deviennent chez nous

| Principe (papier) | Ce qu'il dit | Chez VisionLayer |
|---|---|---|
| Effet réversible (§3.1) | toute modification du contexte rend son inverse ; le moteur garde la suite des inverses et les rejoue à l'envers au retrait | chaque fait porte le pack qui l'a produit ; retirer un pack retire ses faits, et tout ce qui en était déduit est recalculé |
| Coeffet réactif (§3.2) | un composant déclare les clés dont il a besoin ; chaque changement du contexte est classé « active », « désactive » ou « neutre » pour lui | un pack déclare les relations qu'il lit (`requires`) et celles qu'il produit (`provides`) ; une vue déclare les relations du modèle qu'elle dessine |
| Paradigme du contexte (§3.3) | tout effet et tout coeffet passe par un seul contexte ; rien d'autre n'est atteignable | un pack ne touche que la base de faits (`fact()`) ; une vue ne lit que le modèle neutre et n'emploie que les composants de l'interface |
| Équivalence observationnelle (§3.3.2) | deux états sont égaux quand aucun observateur ne les distingue | « charger puis retirer un pack » donne une carte égale à celle calculée sans lui : c'est un test, pas une promesse |
| Isolation par domaines (§3.2.3) | une même clé peut se résoudre autrement dans un contexte dérivé | un pack proposé tourne dans un domaine à part : la carte acceptée et la carte « acceptée + proposée » existent côte à côte, et l'écran montre la différence |
| Interception (§3.2.3, §6.3) | des métadonnées sur le contexte règlent l'usage d'une dépendance sans toucher au composant | un pack proposé ne peut produire que les relations qu'il annonce, et ses faits sont marqués « proposé » jusqu'à l'accord humain |
| Composant et cycle inertiel (§4, §5.1.3) | un composant passe par `LOADING`, `ACTIVE`, `UNLOADING`, `INACTIVE` ; une transition commencée va à son terme | l'écran Packs montre ces états, et `FAILED` avec l'erreur |
| Chargeur déclaratif (§5.2.1) | une configuration persistante (id, url, config, disabled, isolate), réconciliée par différence | `.vision/packs.yaml` liste les packs locaux, leur état et leur domaine ; VisionLayer ne la réécrit que sur un geste humain |
| Rechargement à chaud transactionnel (§5.2.2) | classer les modules changés, trouver les entrées périmées, recharger ; à la moindre erreur, tout remettre comme avant | un pack modifié qui ne passe pas son schéma, ses tests ou son chargement laisse l'ancien en place |
| Frontière du système (§6.1) | ce qui est dedans se défait ; ce qui sort (écrire un fichier, envoyer) se retient ou se compense | dedans : la base de faits et la carte en mémoire. Dehors : `.vision/`, le dépôt, Linear. Rien ne sort sans accord, et le dépôt de l'utilisateur n'est jamais écrit |
| Capacités et bac à sable (§6.3) | déclarer ses dépendances est déjà un contrôle d'accès ; contre du code non sûr, il faut une frontière d'exécution | un agent n'écrit que du déclaratif (requêtes tree-sitter et règles) ; un script TypeScript reste réservé aux packs relus |
| Cycles et granularité (§6.5) | un cycle de dépendances se voit dès les déclarations : les composants restent inactifs | un pack qui lit ce qu'un autre produit, et inversement, est refusé au chargement avec les deux noms |
| Typage et versions (§6.6) | une clé seule ne garantit pas l'accord sur le sens ; collisions, dérives d'interface | les relations neutres (`entity_*`, `accesses`…) sont l'interface partagée, avec leur arité vérifiée ; les relations internes d'un pack portent son préfixe ; chaque pack déclare la version du modèle qu'il vise |

### Effet réversible : un exemple suivi

Un agent propose `drizzle-transitions`, qui lit la forme W6 : `.where(eq(bookings.status, "pending"))` sur la mise à jour de `expireHolds`.

1. **Chargement.** Le pack produit `entity_transition(postgresql, bookings, status, pending, cancelled, src/jobs/expire.ts, 20)`. Ce fait est enregistré comme produit par ce pack : c'est son effet, et son inverse est « retirer les faits de ce pack ».
2. **Déduction.** Les règles en tirent la flèche `pending → cancelled` du cycle de vie.
3. **Retrait** (refus humain, pack corrigé, ou erreur). Les faits du pack disparaissent et les relations déduites sont recalculées. La carte redevient celle d'avant, et le test « charger puis retirer = jamais chargé » le vérifie sur atelier-api.

Notre moteur recalcule déjà ses déductions depuis les faits. Retirer un pack revient donc à jeter ses faits et à relancer les règles : pas besoin de tenir à la main l'inverse de chaque règle. C'est la réalisation « dérivée » du papier (Définition 23) : on construit un nouvel état au lieu de défaire l'ancien en place.

### Coeffet réactif : un exemple suivi

Un pack déclare ses besoins et ses produits :

```yaml
id: drizzle-transitions
requires: [table_in, col_key, fn_span]     # produits par drizzle et par la syntaxe
provides: [entity_transition]              # relation neutre, déclarée dans le modèle
model: 2
```

- **Sans `drizzle`**, `table_in` n'existe pas : le pack reste `INACTIVE` (« désactive »), sans erreur.
- **Dès que `drizzle` est actif**, le changement est classé « active » : le pack se charge.
- **Si `drizzle` est retiré**, `drizzle-transitions` s'éteint d'abord, puis son fournisseur. Le papier garantit cet ordre (§4.3.3) : un dépendant ne lit jamais une relation déjà retirée.

Côté interface, une vue « flèches entre états » déclare `requires: [entity_transition]`. Tant que le modèle n'a pas cette relation, l'onglet Cycle de vie reste tel qu'aujourd'hui, avec la phrase « l'état d'où elle part n'est pas encore lu ». Dès que la relation existe, la vue s'allume dans son emplacement.

## Comment ça marcherait

### 1. Le travail d'un agent sur un pack

VisionLayer ne lance pas d'agent lui-même ([ADR 0013](./0013-visionlayer-control-tower-and-agent-integration.md)). Il prépare une fiche, et l'assistant installé la suit.

1. **Déclencheur.** L'écran Couverture montre une forme non lue (« W6 : à faire »), ou un humain signale une lecture fausse. Au démarrage d'un projet, chaque technologie du lockfile sans pack en est un aussi.
2. **Entrée de la fiche :**
   - la technologie et sa version, lues dans le lockfile ;
   - ses types et sa documentation présents dans le dépôt (`node_modules/<paquet>/*.d.ts`, README) ;
   - le tableau de formes existant.
   Télécharger une documentation demande l'accord de l'utilisateur.
3. **Travail, toujours depuis la technologie, jamais depuis le projet :**
   - l'inventaire des formes de l'API ;
   - un petit fichier d'exemple par forme, avec le fait attendu ;
   - le pack, en requêtes tree-sitter et en règles, sans script ;
   - la page de documentation du pack.
   C'est la garde principale : un agent qui démarre sur un projet voudra faire passer *ce* projet, et taillerait le pack pour lui.
4. **Dépôt** dans `.vision/packs/proposes/<id>/`, avec ses tests.
5. **Vérification par VisionLayer** dans un domaine isolé :
   - le schéma du pack ;
   - les tests de forme ;
   - la règle « le moteur ne connaît aucune pile » ;
   - la différence de faits sur le projet ouvert : faits gagnés, faits perdus, constats nouveaux.
6. **Accord humain** sur l'écran Packs. Le pack passe dans `.vision/packs/` et dans `.vision/packs.yaml`, et le domaine isolé est fusionné. Un refus retire le pack, et la carte reste celle d'avant.

### 2. Le rechargement à chaud

- **Surveillance.** VisionLayer surveille `.vision/packs/` et `.vision/packs.yaml`.
- **Pack modifié.** VisionLayer relit son YAML puis valide le schéma et les déclarations (`requires`, `provides`, version du modèle, cycles). Il relance ensuite l'extraction sur les seuls fichiers que le pack ouvre : la base de faits garde déjà ses faits fichier par fichier. Enfin il recalcule les règles.
- **Transaction.** Une erreur à n'importe quelle étape remet l'ancien pack et ses faits (§5.2.2, Algorithme 10). La carte n'est jamais à moitié rechargée.
- **Interface.** Le serveur prévient l'interface qu'une nouvelle carte existe ; l'écran se met à jour sans rechargement de page.

### 3. Les vues écrites par des agents

On le tente, avec des libertés plus étroites que pour les packs.

- **Emplacements, pas écrans libres.** L'interface expose des emplacements nommés :
  - un onglet d'entité ;
  - une carte du bandeau d'Architecture ;
  - une section du panneau d'un bloc ;
  - une colonne de la grille Données.
  Une vue se pose dans un emplacement. Elle ne remplace pas un écran recodé depuis les maquettes.
- **Coeffets.** Une vue déclare les relations du modèle qu'elle lit. Elle s'allume quand elles existent et s'éteint sinon.
- **Contexte unique.** Une vue reçoit le modèle neutre et les composants de l'interface (`Pill`, `Chip`, `ProofRef`, `CodeExcerpt`, `TechLogo`, les jetons de couleur). Rien d'autre :
  - pas de couleur écrite en dur, pas de requête réseau hors de l'API en lecture seule ;
  - pas de fichier de plus de 150 lignes ;
  - les mêmes tests de frontière que l'interface (`tests/ui-boundaries.test.ts`).
- **Exécution isolée.** Le code d'une vue proposée est du code ; le contrôle par le langage ne suffit pas (§6.3). Elle tourne dans un cadre isolé (une iframe sans accès au reste de la page), qui reçoit le modèle par message. Une vue acceptée et relue peut rejoindre l'interface principale.
- **Preuve visuelle.** Avant l'accord, VisionLayer rend la vue sur le projet ouvert et en montre une capture à côté de la maquette de l'emplacement, quand elle existe.
- **Cohérence.** Un élément déjà dessiné garde le même rendu partout. Une vue qui redessine une carte ou un tableau existant au lieu d'employer son composant est refusée.

### 4. Local d'abord, partagé ensuite

- **Local.** Un pack ou une vue écrit par un agent vit dans le `.vision/` du projet, dans un domaine **local** au sens du papier (§5.2.1, « managed realms »). Il ne touche ni les packs livrés avec VisionLayer ni les autres projets. L'utilisateur choisit de versionner `.vision/` ou non.
- **Partagé, plus tard.** Une place de partage publierait un pack dans un domaine **global**. Avant d'y entrer, il devrait passer ses tests de forme et un projet de contrôle à l'aveugle qui n'est pas celui où il est né. Il déclarerait la version du modèle neutre qu'il vise (une dépendance « pair », §6.6) et serait signé par son auteur. Un pack partagé reste en lecture : chaque projet qui l'installe le voit dans son domaine isolé avant de l'accepter.

## Ce qui ne change pas

- Le serveur MCP reste en lecture seule.
- VisionLayer n'écrit que dans `.vision/`, et seulement sur un geste humain ; le dépôt de l'utilisateur n'est jamais écrit.
- VisionLayer n'est pas un agent : il prépare la fiche, l'assistant installé la suit.
- Un pack décrit une technologie, jamais un projet.
- Un fait sans preuve n'existe pas. Un fait d'un pack proposé dit qu'il est proposé.

## Ordre de mise en œuvre proposé

1. **Faits marqués par pack**, et le test « charger puis retirer = jamais chargé » sur atelier-api.
2. **`requires` et `provides`** dans le schéma des packs : préfixe des relations internes, vérification d'arité des relations neutres, refus des cycles au chargement.
3. **Chargeur de `.vision/packs.yaml`** et rechargement à chaud transactionnel.
4. **Domaine isolé** pour un pack proposé, avec la différence de faits.
5. **Écran Packs** : états, différence, accord. Il reste à dessiner ; le canevas n'a que la page de documentation « 3. Les packs » et l'écran Couverture, d'où part le déclencheur.
6. **Fiche de l'agent** « technologie → inventaire → tests → pack », essayée sur W6 de Drizzle.
7. **Emplacements de l'interface, cadre isolé et premier essai** : la vue « flèches entre états » du cycle de vie.

Faut-il employer Cordis tel quel, ou une version minimale à nous ? Tranché le 31/10 pour les packs : une version minimale (voir « Ce qui est construit »). Nos composants sont d'abord des packs, des données plus que des services, et une version minimale suffit sans doute pour eux. Pour les vues, Cordis (v4 dans le papier, v3 dans Koishi) vaut d'être essayé tel quel. Nous n'avons pas encore lu son code.

## Ce qui est construit (31/10/2026)

Une version minimale à nous, pas Cordis tel quel : nos composants sont des packs, c'est-à-dire des données, et le moteur recalcule déjà tout depuis les faits.

| Étape | Où | Vérifié par |
|---|---|---|
| 1. Faits marqués par pack ; charger puis retirer = jamais chargé | `FactBase.setPacks` : un pack retiré perd ses faits, fichier par fichier ; un pack ajouté ne tourne que sur les fichiers qu'il concerne ; les règles sont recalculées | `tests/pack-hot.test.ts` : sur atelier-api, `node-cron` chargé à chaud donne la carte calculée avec lui (3 tâches planifiées), et retiré, la carte d'avant à l'identique |
| 2. `requires` et `provides`, arités, cycles | schéma des packs ; `PackRegistry.check` : ce qu'un pack produit doit être déclaré, une relation partagée garde son arité, deux packs locaux qui se lisent l'un l'autre sont refusés avec leurs deux noms, un pack dont ce qu'il lit manque reste inactif | `tests/pack-registry.test.ts` |
| 3. Packs locaux et rechargement transactionnel | `.vision/packs/<id>.yaml`, relu à chaque rafraîchissement de la carte (serveur MCP, interface) ; un pack local n'a pas droit à un script ; ses tests sont dans le pack (`tests` : fichiers, faits attendus, faits absents) et tournent dans un dossier à part ; le chargement se fait sur une copie de la base, adoptée seulement si tout passe ; sinon la version d'avant reste en place et le pack est `failed` avec la raison, que le sommaire donné aux agents affiche | idem, dont une version cassée refusée puis corrigée |
| 4. Domaine isolé et différence | `PackRegistry.preview` : un pack proposé est vérifié puis essayé sur une copie ; rend les éléments de carte gagnés et perdus, sans toucher la carte acceptée | idem |

Un pack qui plante sur un fichier, livré ou local, ne fait plus tomber la carte : l'échec devient un manque de couverture (`pack_failed`) qui nomme le pack, l'erreur et les fichiers.

Le moteur de requêtes déclaratives (`match`), qu'aucun pack livré n'employait, sert maintenant aux packs locaux : le test l'exerce sur `node-schedule`, une bibliothèque que les packs livrés ne lisent pas.

## Questions ouvertes

- Le papier laisse au composant la charge de fournir des inverses justes (§5.1.1) ; il ne les vérifie pas. Chez nous, la réalisation dérivée (recalculer depuis les faits) évite d'écrire des inverses. Elle coûte un recalcul des règles à chaque changement, à mesurer sur un gros dépôt.
- Le bac à sable des vues (iframe) doit-il aussi servir aux scripts de packs relus, ou ceux-ci restent-ils dans le processus ?
- Comment présenter la différence de faits pour qu'un humain la juge vite : en nombre par relation, ou en exemples suivis ?
