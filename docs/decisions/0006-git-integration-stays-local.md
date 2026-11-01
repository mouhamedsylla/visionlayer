# ADR 0006 — L'intégration Git de MVP3 reste strictement locale

**Statut :** Accepté

## Contexte
mvp-roadmap.md — MVP3 posait la question sans la trancher : *"si `integrations/git` a besoin d'un token pour un remote privé, ce chemin de code devient HIGH immédiatement (gestion des secrets) — à trancher explicitement au moment de l'implémentation."* Au moment d'implémenter `vision update`/`vision diff`, il faut donc décider si Git est utilisé pour autre chose que lire l'état local.

## Décision
`vision update`/`vision diff` n'utilisent Git que pour lire le commit courant (`git rev-parse HEAD`) sur le dépôt **local**, via `execFileSync` (jamais un shell, jamais de concatenation de chaîne — pas d'injection possible). **Aucun accès réseau, aucun remote, aucun token.** Le "before/after" comparé par `vision diff` n'est pas "avant/après un commit Git" mais "avant/après le dernier `vision update`" — deux snapshots du modèle VisionLayer lui-même, stockés localement dans `.vision/`.

## Rationale
- Résout la question posée par le roadmap en l'évitant : puisqu'aucun secret n'est nécessaire, ce chemin de code reste LOW/MEDIUM, pas HIGH.
- Suffisant pour la valeur recherchée par MVP3 (comparer l'architecture avant/après un changement) sans attendre une intégration CI (étapes 12-13 de la roadmap technique).
- `execFileSync("git", [...])` avec un tableau d'arguments fixe, jamais interpolé dans une chaîne shell, respecte la pratique NIST SSDF PW de codage défensif — même si l'entrée ici (le chemin racine) est déjà interne et non fournie par un tiers non fiable.

## Conséquences
- Si RYPHA a besoin plus tard de comparer contre un commit spécifique ou une branche distante (pas seulement "le dernier update local"), ça nécessitera une nouvelle décision explicite — et probablement là, la question des tokens/secrets redeviendra réelle. Ne pas anticiper cette extension maintenant.
- `currentCommit()` retourne `undefined` sans lever d'exception si le dossier n'est pas un dépôt Git ou si `git` n'est pas installé — `vision update` doit rester utilisable même hors d'un dépôt Git.
