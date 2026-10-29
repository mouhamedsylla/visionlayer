# Agents

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Quelle activité les agents ont-ils sur ce système ? | suivi | activité lue dans les outils reliés : sessions, éléments touchés, lectures par MCP, coût | maquettée (13) |

## 1. Objet

Les sessions des agents de code qui travaillent sur le dépôt : la tâche, les éléments du modèle qu'ils ont modifiés, ce qu'ils ont lu du modèle par MCP, les notes qu'ils ont déclarées, leur consommation.

## 2. Fondement

Quand une part croissante du code est écrite par des agents, savoir **d'où vient un changement** et **ce que l'agent savait du système** au moment de l'écrire devient une question de compréhension, non de surveillance. VisionLayer agit en tour de contrôle : il lit l'activité dans les outils où elle se trouve et renvoie vers eux ; il ne lance ni n'orchestre aucun agent.

## 3. Ce que la vue établit

- L'origine des changements récents.
- Le contexte consulté par un agent avant d'agir.
- La connaissance qu'un agent a ajoutée.

## 4. Représentation

Une chronologie des sessions, chacune avec ses éléments touchés et ses lectures.

## 5. Sources et technologies

Les outils reliés (dépôt, gestionnaire de tâches, journaux d'agents), le journal des lectures MCP.

**Ce qui dépend de la technologie.** La vue ne dépend pas de la pile du projet ; elle dépend des outils reliés.

## 6. Limites

L'activité n'est connue que si l'outil qui la porte est relié.

## 7. Relations

Vers [Revues](revues.md), [Connaissance](connaissance.md).
