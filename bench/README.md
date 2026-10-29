# Banc de validation (temporaire)

Ce dossier sert à **valider** la méthode du doc 04 (connaissance livrée par niveaux), pas à la livrer. Il n'a pas d'écran, n'est pas exposé par le serveur MCP et ne part pas avec le paquet. Une fois le format figé (ADR 0014, RYP-142), il est archivé. Seul le banc déterministe (RYP-184) reste, dans `tests/`.

Référence : `docs/knowledge/04-le-contexte-des-agents.md`, section 11.

## Contenu

| Chemin | Rôle | Ticket |
|---|---|---|
| `criteres.md` | Ce qu'on compte, et les seuils de décision de H1, H2 et H3, fixés avant tout passage | RYP-136 |
| `nafar/scenarios.yaml` | Les sept scénarios sur Nafar : consigne mot pour mot, nuance, affirmations qui la portent, oracle | RYP-136 |
| `nafar/knowledge/` | La connaissance de Nafar donnée aux conditions C et D | RYP-136 |
| `nafar/variants/s6/` | Recouvre un fichier de la connaissance pour S6 (affirmation volontairement fausse) | RYP-136 |
| `nafar/oracles/` | Un oracle par scénario (S6 réutilise celui de S4) | RYP-136 |
| lanceur, mesures | À venir | RYP-185 |

## Le point de départ

Tous les passages partent du commit `6e3b2c4` de la branche `vision/knowledge-prototype` de Nafar : le code réel du 19/09, plus la connaissance du prototype et des marqueurs `// @k` sans texte. Le banc ne modifie jamais le dépôt de Nafar. Il travaille dans un clone jetable par passage.

Dans ce clone, le lanceur :
- **en A et B**, retire `.vision/knowledge/` ;
- **en C et D**, le remplace par `nafar/knowledge/`, puis commite. VisionLayer date une affirmation par le commit qui l'a écrite ; sans ce commit, tout serait « non commité ».

Pour S6, le lanceur applique d'abord les deux commits de préparation décrits dans `scenarios.yaml`. La variante y est commitée avant que le code ne change, et l'affirmation fausse devient « à reconfirmer ».

## Lancer un oracle

```bash
node bench/nafar/oracles/s1.mjs <clone après le passage> 6e3b2c4
```

Pour S6 : `node bench/nafar/oracles/s4.mjs <clone> <commit de base> S6`, où la base est le dernier commit de préparation.

L'oracle écrit un JSON :
- `task` : la consigne a donné lieu au changement attendu ;
- `nuance` : aucune vérification de la nuance n'a échoué ;
- `checks` : le détail.

Il ne lit que le code, jamais le transcript, et n'utilise pas VisionLayer. Il lit les `functions/.env.<projet>` pour S4, mais n'en affiche aucune valeur.

## Ce que les oracles ont passé

Avant d'être commités, les oracles ont été lancés à la main sur un clone :

| Diff | Résultat attendu | Obtenu |
|---|---|---|
| Base intacte | aucune nuance cassée ; tâches non faites | oui, pour les sept |
| Commit d'expérience `9eb6089` (garde « un code, un compte » retiré, plus de réponse 200, plafond relâché) | S1, S3 et S4 cassés | oui |
| S1 : écriture dans `accessCodes` depuis l'app | nuance cassée | oui |
| S1 : sièges explicites, garde gardé | réussi | oui |
| S2 : `refundCredits` ajouté sur l'échec du rendu | nuance cassée | oui |
| S2 : remboursement avec un identifiant par job | réussi | oui |
| S4 : seulement le plafond du jour relevé | nuance cassée (le total à vie l'annule) | oui |
| S4 : jour et total à vie relevés, dans le code ou par projet | réussi | oui |
| S5 : `setDoc` sur le miroir depuis le profil | nuance cassée | oui |
| S7 : libellé changé | réussi | oui |

Ce ne sont pas encore des tests automatiques. Les diffs de référence et piégés deviennent des tests dans RYP-184.

## Limites connues

- **Ce sont des vérifications structurelles** (motifs dans le diff), pas des tests qui exécutent Firestore. Elles peuvent se tromper sur une solution inattendue. La relecture à l'aveugle de dix diffs (§11.8) sert à le repérer.
- **La connaissance n'a pas été écrite entièrement à l'aveugle.** Les affirmations du prototype (28/09) l'ont été avant les scénarios. Cinq ont été ajoutées en écrivant les scénarios, à partir du code réel :
  - `video.lifetime-cap` ;
  - `video.render-failure-not-refunded` ;
  - `wallet.refund-not-idempotent` ;
  - `wallet.ledger-create` ;
  - `access.mirror-read-only`.

  Le rapport (doc 05) le signalera.
- **Les marqueurs `// @k` sont dans le code des quatre conditions.** Ce sont des identifiants sans texte, identiques partout.
