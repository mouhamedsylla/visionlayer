# ADR 0009 — L'interface déclenche scan / update / report sur clic humain ; le serveur MCP reste en lecture seule ; pas de renvoi vers un éditeur

**Statut :** Accepté — remplace en partie [ADR 0008](./0008-ui-read-only-react-flow-elk.md) (section « lecture seule »)

## Contexte
L'ADR 0008 avait rendu l'interface strictement en lecture seule en appliquant la règle de [mvp-roadmap.md — MVP5](../mvp-roadmap.md) : « `vision update` ne doit pas être appelé de façon silencieusement autonome par l'agent ». À l'usage, cela oblige à retourner au terminal pour `scan`, `update`, `report`, ce qui contredit l'objectif même de MVP6 (ne plus taper de commandes pour observer le système).

Relecture de la règle MVP5 : elle vise l'**agent** (NIST AI RMF — Govern : l'agent propose, un humain confirme). Un humain qui clique un bouton « Mettre à jour le modèle » **est** l'étape humaine explicite que la règle exige. La contrainte n'est donc pas « pas d'écriture depuis l'UI », mais « pas d'écriture sans geste humain volontaire ».

Deuxième point clarifié : les boutons « Ouvrir dans l'éditeur » (`vscode://`) allaient à contresens du but. VisionLayer vise **une autre manière de faire la revue de code** : partir du système, descendre jusqu'à la portion de logique concernée et la lire *sur place*. Renvoyer vers VS Code/WebStorm revient à dire « allez lire le fichier entier ailleurs », ce que l'outil cherche précisément à éviter.

## Décision
1. Le serveur de l'interface expose des routes d'écriture, **toutes en `POST`**, jamais appelées au chargement ni par un minuteur : `/api/scan` (premier scan d'un repository), `/api/update` (archive le modèle courant puis le reconstruit), `/api/report` (construit un rapport de changement). Chaque bouton correspondant demande une confirmation explicite dans l'interface.
2. Le repository est **choisi depuis l'interface** (sélecteur + historique des derniers repositories ouverts), plus seulement par l'argument de `vision ui`. Le serveur n'accepte qu'un chemin absolu existant, ouvert volontairement par l'utilisateur.
3. Le **serveur MCP** ([integrations/agents/server.ts](../../integrations/agents/server.ts)) ne change pas : `vision_context`, `vision_inspect`, `vision_source` uniquement. C'est là que la règle MVP5 continue de s'appliquer au sens strict.
4. **Aucun lien vers un éditeur externe.** Les écrans Source et Logique n'affichent que la portion concernée (plage du symbole, lignes d'appel), avec navigation sur place entre symboles et fichiers. Un bouton « Voir le code » remplace « Ouvrir dans l'éditeur ».
5. La logique de scan/update est extraite dans une fonction partagée ([vision/model/scan.ts](../../vision/model/scan.ts)) utilisée par les CLI et par le serveur — une seule implémentation, comme pour `buildInspectResult`.
6. **Échelle** : le graphe affiche une *frontière* et jamais le repository entier — sous-modules repliés du périmètre courant, fichiers directs, blocs voisins touchés, externes regroupés en un nœud. Le niveau Fichiers refuse de se déplier au-delà de 60 fichiers. Le Diff ne montre que les fichiers touchés et leurs voisins à un saut. Décision prise au premier contact avec Nafar (589 fichiers) : la vue à plat de l'ADR 0008 y était inutilisable.

## Rationale
- La gouvernance distingue *qui* déclenche (humain vs agent), pas *par quel canal* (terminal vs bouton). Séparer les surfaces (UI = humain, MCP = agent) rend la règle vérifiable par le code, pas par la discipline.
- Un `POST` sur clic, avec confirmation, laisse une trace claire de l'intention ; un `GET` ou un déclenchement automatique ne le ferait pas.
- Montrer la portion de code sur place est ce qui différencie VisionLayer d'un IDE ; c'est aussi ce qui rend la revue possible depuis une vue architecture sans changer d'outil.

## Conséquences
- [ADR 0008](./0008-ui-read-only-react-flow-elk.md) reste valable pour le rendu (React Flow + ELK) et pour la garde de chemin ; sa section « lecture seule » est remplacée par cette décision.
- Les tests du serveur vérifient désormais : routes d'écriture refusées en `GET`, acceptées en `POST` sur un repository ouvert, et MCP inchangé.
- Le niveau **Infrastructure** (gateway, reverse proxy, CDN, hébergement, différences dev/prod) est inscrit dans la roadmap comme MVP7 ; il demandera une nouvelle source de faits (fichiers de configuration et d'IaC) et une part *déclarée*, affichée comme telle.
