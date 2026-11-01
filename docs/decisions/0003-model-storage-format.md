# ADR 0003 — Format de stockage du System Model

**Statut :** Accepté

## Contexte
Le System Model de VisionLayer (faits + interprétations, `vision-layer-concept.md` §5-6) doit être persisté. L'option d'une base de graphe dédiée dès le départ a été envisagée en [architecture.md §6](../architecture.md).

## Décision
**Fichiers JSON locaux** (`.vision/model.json`, `.vision/graph.mmd`, `.vision/metadata.json`), pas de base de graphe pour le MVP.

## Rationale
- Suffisant pour la taille de repository actuelle (un seul projet pilote) et pour valider si VisionLayer apporte une valeur réelle (le test comparatif de `vision-layer-concept.md` §39) avant d'investir dans une infrastructure de stockage dédiée.
- Cohérent avec le principe "incremental" du document conceptuel (§35) : ajouter une capacité après validation de la précédente, pas avant.
- Une base de graphe reste une migration possible plus tard si le volume de données ou les besoins de requêtage le justifient — le format JSON ne doit pas empêcher cette évolution (voir Conséquences).

## Conséquences
- Le module `vision/model/` doit exposer une interface de lecture/écriture du modèle indépendante du format de stockage (pattern repository), pour qu'une migration future vers une base de graphe ne nécessite pas de réécrire les modules qui consomment le modèle (`context/`, `diff/`, `report/`).
- Pas de requêtage complexe multi-hop pour le MVP — acceptable, car le premier périmètre (MVP0-2) ne le nécessite pas.
