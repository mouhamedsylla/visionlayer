# ADR 0007 — Les CLI `vision` retirent elles-mêmes un `--` littéral

**Statut :** Accepté

## Contexte
Après la migration npm → pnpm ([ADR pnpm](../../package.json) / mémoire de session), la commande documentée dans le guide (`pnpm run scan -- /tmp/mon-essai`) a échoué :

```
Error: ENOENT: no such file or directory, scandir '/chemin/vers/visionlayer/--'
```

**Cause** : contrairement à npm, pnpm ne retire pas le séparateur `--` avant de le transmettre au script — `pnpm run scan -- /tmp/mon-essai` exécute littéralement `tsx cli/scan.ts -- /tmp/mon-essai`. `cli/scan.ts` prenait `process.argv[2]` comme chemin cible, et recevait donc `"--"` au lieu du vrai chemin. Pire : pour `vision context`/`vision report`, qui localisent leurs arguments par position relative au flag `--task`, un `--` en tête décalait aussi la résolution du chemin racine — pas seulement un problème d'affichage.

## Décision
Toutes les CLI (`cli/*.ts`) lisent leurs arguments via `vision/cli/args.ts::cliArgs()`, qui retire tout token `--` littéral avant toute logique de positionnement. `cli/scan.ts` et `cli/update.ts` vérifient en plus que le chemin cible existe (`existsSync`) et affichent un message d'usage clair plutôt que de laisser une stack trace Node brute remonter à l'utilisateur.

## Rationale
- La cause racine est une différence réelle de comportement entre gestionnaires de paquets (documentée, vérifiée empiriquement) — pas une supposition.
- Retirer le `--` dans nos propres CLI rend l'outil robuste indépendamment de npm/pnpm/yarn/invocation directe (`tsx cli/scan.ts -- x` fonctionnera aussi) — corriger uniquement la documentation aurait laissé le bug latent pour quiconque tape `--` par habitude (réflexe npm).
- Un message d'erreur clair sur un chemin inexistant est une amélioration légitime déclenchée par un vrai incident utilisateur, pas du confort ajouté sans raison.

## Conséquences
- Le guide ([README.md](../../README.md)) documente la syntaxe pnpm correcte, sans `--`, mais les CLI tolèrent désormais les deux.
- Tout nouveau CLI ajouté à `cli/` doit utiliser `cliArgs()` dès sa création, pas `process.argv` directement.
