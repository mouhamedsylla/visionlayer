# ADR 0015 — Pour démarrer un projet, VisionLayer lance lui-même des agents

**Statut :** Accepté le 29/09/2026. Modifie une règle de l'[ADR 0013](./0013-visionlayer-control-tower-and-agent-integration.md).

## Contexte

L'ADR 0013 dit que VisionLayer ne lance jamais d'agent : c'est le rôle du board et du harness.

Or VisionLayer doit pouvoir s'ouvrir sur n'importe quel projet existant, y compris chez d'autres équipes. La carte (blocs, points d'entrée, appels, données) se calcule déjà sur tout projet. Le sens, lui, ne se calcule pas : le but des features, les règles, les décisions, ce que veut dire un état. Il est éparpillé dans le code, l'historique Git et les docs. Il faut des agents pour le rassembler, et un humain pour le vérifier ([knowledge/06](../knowledge/06-demarrer-un-projet.md)).

Laisser l'humain lancer ces agents à la main, lot par lot, rend le démarrage trop lourd pour un produit. Sur Nafar, cette connaissance a été écrite à la main pendant le prototype : c'est exactement ce qu'il faut remplacer.

## Décision

**Pendant le démarrage d'un projet, et seulement là, VisionLayer lance des agents**, sur un clic humain (« Démarrer »), en mode non interactif (`claude -p`, `codex exec`).

Leur travail est borné :
- **Ils lisent** le code, l'historique Git local, les docs du dépôt et les sources reliées par l'humain : dans la première version, GitHub et Linear, en lecture seule.
- **Ils écrivent seulement dans `.vision/knowledge/`**, sur une branche dédiée. Chaque affirmation cite sa source, ou reste une hypothèse.
- **Ils ne modifient jamais le code.** Ils ne lisent jamais de fichier `.env`.
- **Ils ne mergent rien.** Le résultat est relu par un humain, dans l'écran de revue du démarrage puis dans la PR.
- **Leur coût en tokens est affiché**, lot par lot, avant et pendant le démarrage.
- **Quand l'information manque, ils posent une question à l'humain** au lieu d'inventer.

Le reste de l'ADR 0013 ne change pas :
- VisionLayer ne lance pas d'agent pour une tâche du board ;
- il n'approuve pas de merge ;
- il ne duplique ni le journal des agents ni l'historique Git ;
- le serveur MCP reste en lecture seule.

## Conséquences

- Nouveaux écrans, maquettés avant d'être construits :
  - ouvrir un projet ;
  - relier les sources (GitHub, Linear) ;
  - préparer le démarrage (sources, lots, coût) ;
  - le démarrage en cours ;
  - les questions à l'humain ;
  - la revue et la couverture.
- Le format des affirmations gagne une **source** et un état **« à confirmer par un humain »** (avec RYP-177).
- La règle « VisionLayer n'écrit dans `.vision/` que sur un geste humain » ([ADR 0009](./0009-ui-human-triggered-actions.md)) est respectée : le démarrage part d'un clic, et ce qu'il écrit passe par une branche et une PR.
- Le démarrage de Nafar remplace la connaissance écrite à la main pendant le prototype. C'est son premier test réel.
