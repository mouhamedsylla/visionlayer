# Vigie

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Une question sur le système, posée depuis n'importe quel écran : que dit le code, preuves à l'appui ? | transversal | les outils MCP de VisionLayer (`vision_context`, `vision_inspect`, `vision_source`, `vision_architecture`, `vision_flow`), appelés par un modèle Muse ; ses réponses et leurs preuves | maquettée le 28/10 (écran 05 du hackathon) ; rien n'est codé |

## 1. Objet

Un panneau qui s'ouvre au-dessus de l'écran courant (⌘J). On y pose une question en langue naturelle. Vigie répond en phrases courtes. Chaque affirmation porte un numéro qui renvoie à sa preuve : une ligne de code, un fait de la carte ou une déclaration d'agent. Quand rien ne couvre la question, Vigie répond « non lu » et dit pourquoi.

## 2. Fondement

Le modèle de langage ne fabrique pas la carte, il la lit. Vigie n'a que les outils de VisionLayer, en lecture seule, et une consigne : n'affirmer que ce qu'un outil a renvoyé. Une réponse sans preuve n'est pas affichée comme une réponse. C'est ce qui le distingue d'un assistant de code ordinaire, qui répond aussi quand il devine.

Vigie n'est pas un agent du projet (ADR 0013). Il ne reçoit aucune tâche, n'écrit aucun fichier, ne lance rien.

## 3. Ce que la vue établit

- La réponse, phrase par phrase, chacune avec ses preuves numérotées.
- Les outils appelés pour la produire, avec leurs arguments : on voit ce que Vigie a regardé.
- Ce qui n'est pas lu, dit comme tel : l'hébergeur, le trafic réel, une technologie sans pack.
- Le modèle qui a répondu et où il tourne : Muse Spark par la Model API, ou Muse Glimmer en local, sans rien envoyer.

## 4. Représentation

- **Le panneau** occupe le tiers droit de l'écran. L'écran d'où il s'ouvre reste visible à gauche, estompé, et la question garde son contexte (« ouvert depuis Accès, `GET /admin/export` »).
- **En-tête :** Vigie, le modèle et un sélecteur « Muse Spark, Model API » ou « Muse Glimmer, sur cette machine ».
- **Une réponse :**
  - la question ;
  - les outils appelés, repliés sur une ligne ;
  - les phrases de la réponse, chaque preuve en exposant numéroté ;
  - les preuves, dans l'ordre des numéros : `fichier:ligne`, la ligne de code, sa provenance (lu, déclaré) ;
  - une ligne « Non lu » quand une partie de la question sort de ce que VisionLayer couvre.
- **Une question hors couverture** reçoit un bloc « Non lu » seul, avec la raison et l'écran qui s'en approche le plus.
- **La saisie** rappelle la règle : « chaque réponse cite ses preuves ».

## 5. L'exemple d'atelier-api

Question, depuis Accès : « Qui peut exporter les données clients ? »

- Outils : `vision_inspect` sur `GET /admin/export`, `vision_flow` sur `exportUsers`, `vision_source` sur `src/admin/export.ts:6-11`.
- Réponse : toute personne connectée. La route n'exige que `requireUser` [1], puis lit l'email, le nom et le téléphone de tous les clients [2]. Le rôle admin, exigé par le remboursement [3], n'est pas vérifié ici, et aucun code ne l'attribue [4].
- Non lu : un filtre posé devant l'API par Fly.io. La configuration de l'hébergeur ne le montre pas.

Question hors couverture : « Combien de clients ont déjà utilisé l'export ? » Réponse : non lu. VisionLayer lit le code, pas le trafic ni les journaux.

## 6. Selon la taille du projet

La forme ne change pas. Sur un grand système, les preuves se regroupent par service, et Vigie dit combien de résultats il n'a pas cités (« 14 autres routes du même genre, ouvrir dans Accès »).

## 7. Ce qui manque

| Élément | État |
|---|---|
| Outils MCP en lecture seule | codés (`integrations/agents/server.ts`) |
| Boucle d'appels d'outils avec Muse Spark 1.3 (Model API, appels parallèles) | à faire, pendant le hackathon |
| Refus d'afficher une affirmation sans preuve | à faire |
| Muse Glimmer en local | à faire ; ses appels d'outils ne sont pas documentés |

## 8. Limites

Vigie ne juge pas la gravité et ne propose pas de correctif. Il dit ce que le code fait. Le correctif revient à l'agent du projet, le jugement à l'humain.

## 9. Relations

Ouvert depuis tous les écrans. Chaque preuve renvoie à l'écran qui la montre : Accès, Carte, Points d'entrée, Connaissance.
