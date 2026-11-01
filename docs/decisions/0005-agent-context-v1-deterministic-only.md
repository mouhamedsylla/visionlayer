# ADR 0005 — Agent Context v1 : déterministe uniquement, pas d'interprétation LLM

**Statut :** Accepté

## Contexte
mvp-roadmap.md — MVP2 exige explicitement que `vision context --task` distingue faits et interprétations **dès la première version**, sous peine qu'un agent traite une interprétation potentiellement fausse comme un fait acquis (gouvernance §6, [RYPHA_Governance_and_Standards_Framework.md](../../../governance/RYPHA_Governance_and_Standards_Framework.md)). L'exemple conceptuel de [vision-layer-concept.md §9](../vision-layer-concept.md) inclut une section "CONSTRAINTES" (ex. "token is single-use") qui ne peut être produite que par une interprétation sémantique — aucun outil déterministe ne peut déduire cette contrainte du seul code.

## Décision
La v1 de `vision context --task` ne produit **que des faits déterministes** : sélection de fichiers/symboles pertinents par correspondance de mots-clés (tokenisation du texte de la tâche vs. noms de symboles/chemins/ré-exports), plus leurs voisins directs dans le graphe de dépendances. **Aucune section "flows" ni "contraintes" n'est produite dans cette version** — pas même une section vide présentée comme "analysée" : ces capacités n'existent simplement pas encore, ce qui est différent d'avoir été calculées et n'avoir rien trouvé.

## Rationale
- Correspond au principe "Deterministic-first" ([vision-layer-concept.md §35](../vision-layer-concept.md)) : utiliser les faits calculables avant d'introduire une interprétation LLM.
- Évite d'introduire une dépendance à un fournisseur LLM (clé API, coût, latence, gestion de secret) avant d'avoir prouvé que la sélection déterministe seule apporte déjà de la valeur (test comparatif prévu en [vision-layer-concept.md §39](../vision-layer-concept.md)).
- Une future version pourra ajouter une couche d'interprétation sémantique **au-dessus**, mais elle devra être visuellement et structurellement distincte des faits (ex. un champ `interpretation` séparé, jamais mélangé dans la même liste) — pas une modification de cette version.

## Conséquences
- `vision context --task "..."` produit : fichiers/symboles correspondant directement aux mots-clés de la tâche (y compris les noms ré-exportés, pas seulement les symboles déclarés), plus leurs dépendances et dépendants directs (un seul saut).
- La sortie doit afficher explicitement qu'aucune interprétation sémantique n'a été effectuée, pour ne jamais laisser croire à un agent consommateur que l'absence de contraintes affichées signifie "aucune contrainte connue".
- Pas de classement par pertinence ni de plafond sur le nombre de résultats dans cette version (repositories de test restent petits) — à revisiter si le volume devient un problème réel, pas avant.
