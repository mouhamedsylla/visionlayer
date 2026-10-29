# ADR 0016 — Créer un projet : un assistant propose, VisionLayer écrit une fois ce que l'humain a validé

**Statut :** Accepté le 30/09/2026. Étend l'[ADR 0015](./0015-demarrage-d-un-projet-par-des-agents.md) et fait une exception à l'[ADR 0009](./0009-ui-human-triggered-actions.md).

## Contexte

VisionLayer doit aussi accueillir un projet vide et le démarrer selon les bonnes pratiques du développement agentique :
- des principes écrits une fois (la « constitution » de Spec Kit) ;
- une spécification testable, au format « QUAND…, LE SYSTÈME DOIT… » (EARS, comme dans Kiro) ;
- une architecture prévue, avec ses règles ;
- des tâches ordonnées ;
- les fichiers que les agents lisent : AGENTS.md, CLAUDE.md, `.claude/rules/`, les skills, la configuration MCP.

VisionLayer n'est pas un agent : il ne comprend pas un texte et ne peut pas le reformuler. Mais c'est un programme : il peut écrire un fichier dont le contenu est déjà décidé.

## Décision

1. **L'assistant se choisit au début (étape 0).** VisionLayer cherche sur la machine ceux qui sont installés et connectés (Claude Code, Codex…). Il lance celui qui est choisi, en mode non interactif, **seulement sur un clic** :
   - « Proposer les exigences » ;
   - « Proposer une architecture » ;
   - « Découper en tâches ».

   L'assistant propose et cite d'où vient chaque élément. Ce que le texte de l'humain ne dit pas devient une question. Il n'écrit aucun fichier. Sans assistant, tout se fait à la main.
2. **VisionLayer écrit lui-même les fichiers validés, une seule fois, au clic « Créer ».** C'est une exception à la règle « VisionLayer n'écrit que dans `.vision/` ».
   - Le contenu écrit est exactement celui que l'humain a relu dans l'aperçu : aucun agent ne le recopie, donc rien ne peut changer en route.
   - Un fichier qui existe déjà n'est jamais remplacé sans accord. VisionLayer montre la différence ; le choix par défaut est d'ajouter ce qui manque.
   - Après la création, la règle de l'ADR 0009 revient telle quelle.
3. **Les tickets sont créés par l'assistant, pas par VisionLayer.** Au clic « Créer », l'assistant crée le projet, le backlog et les tickets dans le gestionnaire choisi (Linear, Jira…), par le serveur MCP de cet outil. VisionLayer reste en lecture seule sur ces outils.
4. **VisionLayer n'organise pas le travail des agents.** L'étape 5 écrit leurs fichiers ; comment ils se répartissent le travail relève du workflow (RYPHA Fabric), pas de VisionLayer.

## Conséquences

- Écrans maquettés : C0 à C6, et les états après chaque bouton (C1b, C1c, C2a, C2b, C3b, C4b, C5b).
- Le coût en tokens de chaque proposition est affiché sous la proposition, comme au démarrage. Jamais de prix sans tarif déclaré.
- Le reste de l'ADR 0013 ne change pas :
  - pas d'agent lancé pour une tâche du board ;
  - pas de merge approuvé ;
  - le serveur MCP de VisionLayer reste en lecture seule.
