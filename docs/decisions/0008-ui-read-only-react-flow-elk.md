# ADR 0008 — Interface visuelle (MVP6) : serveur local en lecture seule, React Flow + ELK, logique calculée à la demande

**Statut :** Accepté

## Contexte
Jusqu'à MVP5, VisionLayer n'est observable que par ligne de commande et par le fichier `graph.mmd` (Mermaid). La mission de VisionLayer est pourtant une *observation visuelle* du système : navigation Système → Module → Fichier → Symbole → Source, diff d'architecture lisible, et un niveau « Logique » (séquence d'appels d'une fonction) que ni la CLI ni Mermaid ne rendent. Trois options ont été évaluées pour le rendu du graphe :

1. **Mermaid** (déjà généré) — pas d'interactivité fine (clic sur un nœud, mise en évidence des arêtes d'un nœud), routage des arêtes peu lisible dès qu'il y a des croisements, et aucun moyen de piloter la vue depuis `model.json` sans régénérer du texte.
2. **`cathrynlavery/diagram-design`** — un *skill* d'agent qui produit des SVG statiques stylés, pas une bibliothèque pilotable par programme : impossible de brancher un clic, un rafraîchissement ou un diff. Utile éventuellement pour un export présentable d'un rapport, pas comme moteur d'interface.
3. **Bibliothèque de graphe interactive** (React Flow, Cytoscape.js, D3) — la seule qui réponde au besoin.

## Décision
- **`vision ui [root]`** ([cli/ui.ts](../../cli/ui.ts)) démarre un serveur HTTP local ([vision/ui/server.ts](../../vision/ui/server.ts)) qui expose **uniquement des routes de lecture** (`/api/model`, `/api/inspect`, `/api/source`, `/api/file`, `/api/calls`, `/api/diff`, `/api/events`) en réutilisant les fonctions déjà partagées par la CLI et le serveur MCP (`buildInspectResult`, `resolveSymbol`, `diffModels`, `classifyPath`). Aucune route n'écrit dans `.vision/` : `vision update` reste une commande humaine explicite, comme exigé par [mvp-roadmap.md — MVP5](../mvp-roadmap.md).
- **Frontend** dans [ui/](../../ui/) : Vite + React, graphe rendu par **React Flow** avec une mise en page **ELK** (`layered`, `edgeRouting: ORTHOGONAL`, hiérarchie pour les conteneurs de modules). ELK produit les points de pliage ; React Flow ne fait que dessiner et gérer le zoom/clic. Le modèle interne reste indépendant du rendu ([architecture.md §3.2](../architecture.md)).
- **Trois niveaux, même modèle** : Architecture (un module = un dossier, un conteneur = un dossier parent, arêtes agrégées avec compteur), Fichiers (un nœud par fichier, deux lignes : dossier / nom), Logique (séquence des appels sortants d'un symbole, résolus vers un import, un symbole local, ou laissés non résolus). Le niveau Logique est calculé **à la demande** par [vision/logic/calls.ts](../../vision/logic/calls.ts) à partir du fichier source — il n'est pas stocké dans `model.json`, dont le périmètre reste le graphe de fichiers ([ADR 0003](./0003-model-storage-format.md)).
- **Lecture de fichier source bornée** : `/api/file` et `/api/calls` ne servent qu'un chemin présent dans le modèle, après `assertWithinRepo` (même garde que MVP1).

## Rationale
- Réutiliser `buildInspectResult`/`diffModels` évite une troisième implémentation de la même logique (CLI, MCP, UI) et garantit que l'interface montre exactement ce que la CLI imprime.
- ELK est le seul moteur de mise en page open source qui fait à la fois le placement en couches, les conteneurs imbriqués et le routage orthogonal — ce que les maquettes validées demandent (segments droits, libellés qui tiennent dans le cadre).
- Calculer la séquence d'appels à la demande garde `model.json` stable et petit ; si ce niveau s'avère utile dans `vision context`, on pourra alors décider de le persister, avec un ADR dédié.
- Faits / interprétations : l'interface affiche une section « Interprétation » vide et marquée « non renseigné » plutôt que de la masquer, pour que la distinction de la gouvernance §6 soit visible dès la première version ([ADR 0005](./0005-agent-context-v1-deterministic-only.md)).

## Conséquences
- Nouvelles dépendances de développement : `vite`, `react`, `@xyflow/react`, `elkjs` (classification MEDIUM — nouvelle dépendance, aucun accès/secret/prod).
- `pnpm run ui:build` produit `ui/dist/` (ignoré par Git) que `vision ui` sert ; en développement, `pnpm run ui:dev` sert le front et proxifie `/api` vers `vision ui`.
- Le bouton « Ouvrir dans l'éditeur » utilise le schéma `vscode://file/…:ligne` ; un autre éditeur demandera une option de configuration.
- L'interface est pensée pour un poste de travail (largeur ≥ 1180 px), pas pour mobile.
