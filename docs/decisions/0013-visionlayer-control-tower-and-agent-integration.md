# ADR 0013 — VisionLayer est la tour de contrôle du projet : il lit les autres outils, n'en remplace aucun, et s'intègre aux agents par leurs mécanismes réels

**Statut :** Accepté (positionnement et intégration des agents ; la construction suit en phases)

## Contexte
La maquette de toutes les interfaces (22 écrans, design system « Calque / Plan ») a fait déborder VisionLayer sur le rôle d'autres outils du workflow ([architecture.md §2](../architecture.md)) :
- un bouton « Lancer avec Claude Code » et la tâche réécrite dans VisionLayer : c'est le rôle du board / de Linear et de l'agent ;
- un bouton « Approuver le merge » : c'est la revue GitHub, avec la protection de branche et CODEOWNERS ([policies/branch-protection-setup.md](../../policies/branch-protection-setup.md)) ;
- un journal de session d'agent refait à l'identique : Claude Code et Codex en ont déjà un ;
- un historique qui doublait Git.

Or la conception de départ dit déjà ce que VisionLayer n'est pas : ni un IDE, ni Git, ni Linear, ni un agent, ni une CI. Le premier utilisateur l'a formulé ainsi : VisionLayer est fait pour l'humain (le développeur, et d'autres devs avec lui). Il doit exploiter les vraies capacités des agents sans piétiner les autres outils du workflow : c'est une **tour de contrôle**.

## Décision

### Qui fait quoi

| Rôle | L'outil qui en est propriétaire | Ce que VisionLayer en fait |
|---|---|---|
| La tâche, sa priorité | Linear / board du projet | lit la tâche, renvoie vers elle, calcule le **contexte** de la tâche |
| Raisonner, écrire le code | l'agent (Claude Code, Codex…) et l'IDE | donne la carte à l'agent (MCP, lecture seule) ; **observe** l'effet de l'agent sur le système |
| Le code, l'historique | Git | lit les commits et les branches, renvoie vers eux |
| La revue, la décision de merge | GitHub (PR, CODEOWNERS, protection de branche) | explique **pourquoi** un changement est HIGH et **ce qu'il fait au système**, puis renvoie vers la PR ; ne décide jamais |
| Tests, Semgrep, build | la CI | affiche leur statut et y ajoute le **diff d'architecture** |
| Le déploiement, la prod | CI/CD, cloud, observabilité | décrit ce qui est déployé et où (lu dans la configuration) |
| **Comprendre le système** | **VisionLayer** | carte, blocs, données, features et leurs algorithmes, diff d'architecture, fiches, déclarations |

### Trois règles
1. **Lire chez les autres, renvoyer vers eux.** Tout état qui appartient à un autre outil (tâche, statut de PR, CI) s'affiche avec sa source et un lien, sans jamais être modifié depuis VisionLayer.
2. **N'écrire que ses propres fichiers** : `.vision/` (modèle, carte, fiches, déclarations), toujours à travers un geste humain ([ADR 0009](./0009-ui-human-triggered-actions.md)) ou une PR. Le serveur MCP reste en lecture seule.
3. **Apporter ce qu'aucun autre outil ne voit** : l'effet d'un changement, humain ou agent, sur le système.

### Intégration des agents, par leurs mécanismes documentés

| Sens | Claude Code | Codex | Usage |
|---|---|---|---|
| L'agent lit VisionLayer | serveur MCP dans `.mcp.json` | `[mcp_servers.visionlayer]` dans `config.toml` (global ou `.codex/`) | `vision_context`, `vision_inspect`, `vision_source` (existants) ; `vision_architecture`, `vision_flow` (à ajouter) |
| Consignes au projet | `CLAUDE.md` | `AGENTS.md` | une seule consigne : lire la carte avant de coder, joindre le rapport et les fiches à la PR |
| VisionLayer observe l'agent | hooks : type `http` vers le serveur local de VisionLayer (`SessionStart`, `PostToolUse`, `Stop`, `SessionEnd`), avec `session_id`, `transcript_path`, `tool_input` | hooks `command` ou `mcp_tool` (mêmes événements, avec `turn_id`) | un **journal d'activité** séparé du modèle : fichiers, donc blocs, touchés par chaque session |
| Parler à une session en cours | *channels* (aperçu de recherche) | `codex app-server` (JSON-RPC) | **pas maintenant** : c'est le rôle du harness |
| Travail ponctuel | `claude -p --output-format json` | `codex exec --json` | **pas maintenant** ; plus tard, sur demande humaine seulement (par exemple rédiger une fiche manquante dans une PR) |

Les trois premières lignes forment un **paquet d'intégration par agent**, installable en une commande : un plugin Claude Code (serveur MCP, hooks et consigne), et une configuration Codex équivalente. Le journal reçu par les hooks n'altère jamais la carte. Il ne contient que des chemins de fichiers et des noms d'outils, jamais le contenu d'un prompt ni celui d'un fichier `.env`.

### Économiser le contexte des agents (livré)
Chaque caractère renvoyé par le serveur MCP est payé en tokens par l'agent, à chaque appel. Mesures sur un projet réel (≈ 3,6 caractères par token, estimation) :

| Appel | Avant | Maintenant |
|---|---|---|
| `vision_context` « le fil de discussion Awa » | 72 630 car. ≈ 20 000 tokens (JSON indenté, tous les symboles de chaque fichier) | 5 028 car. ≈ 1 400 tokens (JSON compact, seuls les symboles qui correspondent ; `detail: true` pour le reste) |
| `vision_architecture` | — | carte entière 6 777 car. ≈ 1 900 tokens ; **un seul bloc** (`block: "Firestore"`) 3 202 car. ≈ 900 tokens |
| `vision_flow videoCreate` | lire `job.ts` : 23 665 car. ≈ 6 600 tokens, sans les effets des fonctions appelées | 4 489 car. ≈ 1 250 tokens, effets en profondeur compris (appels sans effet omis, `full: true` pour les voir) |

Règle pour les outils suivants : texte condensé ou JSON compact, un paramètre pour restreindre (un bloc, une feature), le détail seulement sur demande.

### Coût en tokens d'une feature (livré en CLI)
Les deux agents écrivent déjà, **en local**, la consommation de chaque tour :
- Claude Code : chaque message du transcript (`transcript_path`, fourni aux hooks) porte `usage` (`input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`). `claude -p --output-format json` donne aussi `total_cost_usd`, et l'export OpenTelemetry émet `claude_code.token.usage` et `claude_code.cost.usage`.
- Codex : le fichier de session (`~/.codex/sessions/…/rollout-*.jsonl`) contient des événements `token_count` (`input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_output_tokens`) ; `codex exec --json` les donne dans `turn.completed`.

VisionLayer additionne ces compteurs par session. Il attribue ensuite une session aux features dont elle a modifié le code (fichiers édités, reçus par les hooks, rapprochés des fichiers de chaque feature sur la carte). Il affiche enfin, par feature, les tokens et le coût estimé **des sessions qui l'ont construite ou modifiée**, avec le détail des sessions. C'est une attribution déterministe et vérifiable, pas une estimation par un modèle. Une session qui touche plusieurs features est répartie au prorata des fichiers modifiés, et c'est indiqué. Les contenus des transcripts ne sont jamais copiés : seuls les compteurs sont lus.

Premier relevé réel (le transcript Claude Code de la session qui a construit ceci) : 157 M tokens lus depuis le cache, 2,8 M écrits dans le cache et 0,8 M de sortie, pour un millier de tokens d'entrée hors cache. **La lecture du cache domine, de très loin** : à chaque tour, l'agent relit tout son contexte. Chaque token qu'un outil ajoute au contexte est donc repayé à tous les tours suivants. C'est pour ça que les outils MCP doivent rester courts.

Tarifs : VisionLayer n'en invente aucun. Ils sont déclarés dans `.vision/prices.json` (prix par million de tokens, par modèle ou par préfixe) ; sans tarif, le rapport donne les tokens seuls, et un modèle sans tarif ne donne aucun montant plutôt qu'un montant faux.

### Collaboration entre développeurs
Rien n'exige un serveur partagé. Ce qui se partage passe par le repository : fiches, déclarations et politique dans `.vision/` et `policies/`, rapports dans les PR. Pour la vue d'équipe, VisionLayer lit les branches distantes (`git fetch`) et calcule les blocs que chacune touche. Il peut alors signaler un **chevauchement** : deux branches ou sessions qui modifient le même bloc ou la même collection.

## Conséquences
- Maquette corrigée :
  - **12 Tâche** : lue depuis le board ; plus de bouton « Lancer ».
  - **13 Agents** : l'effet sur le système, les lectures de la carte et les chevauchements ; le journal complet reste dans l'agent.
  - **16 Rapport** : il vit dans la PR.
  - **17 Approbations** : statut lu dans GitHub ; la décision se prend dans la revue GitHub.
  - **18 Historique** : l'évolution de l'architecture ; chaque entrée renvoie à son commit.
  - **00 Inventaire** : ajoute l'outil propriétaire de chaque étape.
- Travaux à venir, dans cet ordre :
  1. ~~`vision_architecture` et `vision_flow` dans le serveur MCP~~ (livré, avec `vision_context` compact) ;
  2. ~~le journal d'activité alimenté par les hooks des deux agents, et le coût en tokens par feature~~ (livré : `vision hook`, `vision cost`, [vision/activity/](../../vision/activity/)) ; reste l'écran dans l'interface ;
  3. le paquet d'intégration (plugin Claude Code, configuration Codex) avec la consigne `CLAUDE.md` / `AGENTS.md` ;
  4. le calcul des chevauchements entre branches ;
  5. les fiches d'agent (phase 2 de l'[ADR 0012](./0012-runtime-architecture-and-feature-flows.md)).
- Écarté pour l'instant : lancer ou piloter un agent depuis VisionLayer, approuver depuis VisionLayer, héberger un serveur partagé.

## Sources
- Claude Code : [hooks](https://code.claude.com/docs/en/hooks.md), [MCP](https://code.claude.com/docs/en/mcp.md), [channels](https://code.claude.com/docs/en/channels.md), [mode non interactif](https://code.claude.com/docs/en/headless.md), [mémoire / CLAUDE.md](https://code.claude.com/docs/en/memory.md), [plugins](https://code.claude.com/docs/en/plugins/overview.md).
- Codex : [MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [hooks](https://learn.chatgpt.com/docs/hooks), [App Server](https://developers.openai.com/codex/app-server), [CLI](https://developers.openai.com/codex/cli).
