# Les maquettes de VisionLayer, et où en est l'interface

**Source :** le canevas « VisionLayer — tous les écrans » (claude.ai/artifact/KcvN7pXMdQdmcc2uFXv2tD), copié ici le 11/10/2026 dans [maquettes/](./maquettes). `maquettes/canvas.json` est l'index : pages, titres et positions des planches. Chaque planche est un fichier `.dc.html` ; les feuilles communes (`shell.css`, `explo.css`, `replay.css`, `vl-tokens.css`, `ds/visionlayer/`) sont à côté.

Le canevas reste la référence quand il change : on recopie, on ne modifie pas la copie à la main.

## Recoder un écran

1. Relire sa planche **et celles qu'elle ouvre** (un nom souligné en pointillé mène à une autre planche).
2. Relire sa fiche dans [docs/lire-le-systeme/vues](../docs/lire-le-systeme/vues) : la question à laquelle il répond.
3. Reprendre les améliorations ci-dessous, même si la maquette ne les montre pas.
4. Vérifier sur atelier-api et sur un projet d'une autre pile.

## Les améliorations que les maquettes ne montrent pas

Elles ont été ajoutées en codant les premiers écrans. Elles valent pour **tous** les écrans restants, et un écran plus ancien qui ne les a pas encore doit les recevoir.

| Amélioration | Où elle est déjà | Partie partagée |
|---|---|---|
| Termes techniques marqués dans chaque phrase : verbe HTTP en badge, route, nom de code, valeur, variable, fichier, code de réponse, bloc, table, file | partout (efc7931) | `TechText`, `RouteKey` |
| Logo de la technologie sur les blocs, tuiles et lignes (Simple Icons, monogramme sinon) | Architecture, Bloc, Technologies | `TechLogo` |
| Cartes du bandeau qui portent chacune leur propre forme (logos, barre, jauge, compteurs) avec de vraies données | Architecture, Vue d'ensemble | `FactsRow`, `FactVisual` |
| API groupée par ressource : méthode, garde, appelant, effets | Bloc | `ApiView`, `RouteRow` |
| En-tête d'écran collant qui se resserre au défilement ; en-têtes de tableau et couloirs de trace collants dessous | partout (3b60a07) | `ScreenHeader`, `useStickyHeader` |
| Panneau de droite à défilement propre, sections repliables avec leur compte, 5 lignes puis « Voir les N autres », preuve `fichier:ligne` à droite | partout | `SidePanel`, `PanelSection`, `PanelFold`, `ProofRef` |
| Panneau construit des mêmes pièces : compteurs en tuiles, tables touchées marquées, branches dessinées en aiguillage, variables | Données, Messages, Features, Contrats (f42b174) | `PanelStats`, `PanelCard`, `PanelReach`, `PanelSwitch`, `PanelVars` |
| « À savoir » dans l'en-tête : un bouton qui compte les points, puis la liste rangée qui défile (urgents d'abord), jamais des chips empilées | Technologies, Déploiement, et tout en-tête d'écran | `Glance`, `ScreenHeader` |
| Code lu sur place, sur fond nuit, sans renvoi vers l'éditeur | Code, Features, Bloc | `CodeExcerpt`, `CodePeek` |
| Couloirs de trace qui gardent leur largeur : le texte passe au-dessus des flèches quand la place manque | Features, Messages (0f35000) | |
| Barre latérale qui glisse et se replie en gardant le logo, choix gardé au rechargement | coquille (01cb67a) | `Sidebar`, `useStoredFlag` |
| Puce projet (nom, branche, commit) et fraîcheur (heure, temps écoulé), bouton d'actualisation qui tourne | coquille (3f75514, e56fec9) | `Topbar`, `Freshness` |
| Jamais de coupure au milieu d'un mot | partout | `Breakable` |
| Une donnée absente du modèle n'est pas inventée : l'écran attend, ou dit « non lu » | partout | `StatusMessage` |

Règles de code : 150 lignes par fichier au plus, une feuille de style par composant, aucune couleur hors de `theme/tokens.css`, rien importé de l'archive ([tests/ui-boundaries.test.ts](../tests/ui-boundaries.test.ts)). Clair seulement : le sombre n'est pas validé.

## Correspondance planche → écran

État au 11/10/2026, d'après `ui/src/app/screens.ts` et l'historique Git.

### Page « 3 · Les écrans »

| Planche | Fichier | Écran codé | État |
|---|---|---|---|
| 01 Vue d'ensemble | `ExploVue` | `screens/overview` | fait (2444c0d) |
| 03 Bloc | `ExploBloc` | `screens/block` | fait |
| 06/07 Features, déroulé tracé | `ExploFeature` | `screens/features` | fait (85acbcb) |
| 05 Données | `ExploDonnees` | `screens/data` | fait (000ceb7) |
| 30 Cycle de vie | `ExploCycle` | `screens/data/EntityScreen` | fait |
| 27 Contrat | `ExploIA` | `screens/contracts` | fait (464403d) |
| 28 Messages, trajet | `ExploTasks` | `screens/messages/JourneyScreen` | fait (dfdf19b) |
| 42 Sans clic | `Arriereplan` | `screens/messages` | fait (dfdf19b) |
| 10 Code | `ExploCode` | `screens/code` | fait (fbef2a9) |
| 08 Technologies | `Technologies` | `screens/technologies` | fait (4b2b59e) |
| 09 Déploiement | `Deploiement` | `screens/deploy` | fait (7740c33) |
| 16 Couverture | `Couverture` | `screens/coverage` | fait (2502d5f) |
| 26 Accès (ex-Identité) | `ExploAuth` ; remaquetté le 11/10 en deux onglets : `Acces` et `AccesRoutes` (atelier-api), `AccesGrand` et `AccesGrandRoutes` (grand système, exemple) | `screens/identity`, entrée « Accès » | codé en partie ; à recoder depuis `Acces` et `AccesRoutes` une fois la maquette validée |
| 43 En même temps | `Concurrence` | — | **à coder** (détections en partie là : e6191f1) |
| 44 Pannes | `Pannes` | — | **à coder** (détection en partie là : 1e9230b) |
| 45 Données personnelles | `DonneesPerso` | — | **à coder** (détection en partie là : 304687d) |
| 41 Impact | `Impact` | — | **à coder** |
| 15 Revue d'une PR | `ExploRevue` | — | **à coder** (entrée « Revues » grisée) |
| 14 Connaissance | `ExploConnaissance` | — | **à coder** (entrée grisée) |
| 13 Agents | `ExploAgents` | — | **à coder** (entrée grisée) |
| 40, 40b, 40c, 40d Réglages | `Reglages*` | — | **à coder** (entrée grisée) |

### Les autres pages

| Page | Planches | État |
|---|---|---|
| 0 · Le workflow | 00 `Inventaire` | référence, pas un écran |
| 1 · Accueil et démarrage | B0 `Accueil` ; B1–B6 et B2a–c (`ExploOuvrir`, `ExploDem*`, `DemRelier*`) ; C0–C6 et variantes (`Creer*`) | **à coder** |
| 2 · Architecture | A1 `ArchiStyles`, A2 `ArchiServerless`, A3 `ArchiMicroservices` | `screens/architecture` codé ; la disposition par style (A1) reste à vérifier |
| 4 · L'intérieur d'un bloc | B1 `BlocComposition`, `BlocSelection`, B3 `Composant` | fait (e65d1c9) ; B2 `BlocCouplage` et B4 `DerouleEntree` mis de côté |
| 8 · Replays | R0–R5 et variantes (`Vigie*`, `Replay*`) | principe validé, **à coder** plus tard (section optionnelle) |
| Présentation | `Landing`, `LandingAnimations`, `SiteRypha`, `SiteCatalogue`, `SiteDecisions`, `Logo` | landing codée dans `landing/` ; pages RYPHA, Catalogue, Décisions à faire (RYP-219) |
| Documentation | `Doc*` | le texte vit dans `docs/fonctionnement/` |
| Archives | anciens écrans | ne pas recoder |

## Décidé, pas encore fait

- **Corpus de contrôle (RYP-224)** : corriger les 9 limites trouvées dans notre pile, test d'abord ; puis trois nouveaux projets de contrôle dans la pile, avec l'oracle écrit avant le lancement.
- **Neutralité (ac5b94b)** : un fait garde sa technologie comme qualification, pas seulement comme logo ; les écrans doivent montrer ce qui en dépend (garanties, transactions, livraison). C'est écrit dans la doc, pas encore dans le code.
- **Composants** : les garanties et le commentaire d'ouverture de l'auteur ne sont pas encore lus par le moteur.
- **Composition et échelle** ([grammaire](../docs/lire-le-systeme/grammaire/06-grammaire-visuelle.md), 11/10) : tout écran se dessine d'abord pour un grand système. À reprendre sur les écrans codés : les blocs en colonnes de l'écran Données passent en filtre au-delà de six ; vérifier les autres tables sur un projet de plusieurs dizaines de blocs.
- **Planches mises de côté** : B2 Couplage devient l'Impact d'un composant (écran 41) ; B4 enrichira la trace des Features.
- **Retrait de l'ancien moteur** (`vision/arch/build.ts`) une fois tous les écrans recodés (RYP-197).
- **Sombre** : nouvelle maquette à valider avant tout code (RYP-202).
- **Logo « des points aux blocs »** dans l'interface et le paquet (RYP-220).
- **ADR 0019** (packs et vues écrits par des agents) : proposé, pas accepté.
- **Replays** : `idea.md` (Engineering Challenges, à la racine, non commité) décrit la même idée que la page 8.
- **En pause** : pack Firebase (RYP-191), donc Nafar.
