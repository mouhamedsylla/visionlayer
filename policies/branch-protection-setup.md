# Runbook — Activer la gouvernance minimale sur un dépôt GitHub

**But :** rendre `codeowners.template` réellement contraignant (bloquer un merge HIGH sans approbation), pas juste déclaratif.

**Important :** ce runbook est à exécuter par vous, sur le dépôt produit réel (ex. Nafar) — je n'ai ni accès à votre GitHub, ni le nom du dépôt cible, donc je ne peux pas l'exécuter à votre place. Remplacer `{owner}/{repo}` partout ci-dessous.

---

## ⚠ Constat vérifié sur rypha-fabric (2026-09-06)

Sur un dépôt **privé** avec un compte GitHub **gratuit** (personnel, sans organisation Team/Enterprise), l'API de branch protection renvoie systématiquement :

```
403 — Upgrade to GitHub Pro or make this repository public to enable this feature.
```

Testé avec et sans l'exigence "require code owner reviews" — **c'est toute la fonctionnalité qui est indisponible**, pas seulement la partie CODEOWNERS. Aucun contournement gratuit natif à GitHub n'existe pour un dépôt privé sous ce plan (pas de branch protection classique, pas de repository rulesets — ces deux mécanismes dépendent du même palier de plan).

**Décision actée** : rester privé, sans enforcement technique pour l'instant. Conséquence à assumer consciemment : `.github/CODEOWNERS` documente *qui devrait* approuver un changement HIGH, mais **rien ne bloque mécaniquement** un push direct sur `main` ou un merge sans review tant que le dépôt reste sur ce plan. C'est un engagement procédural (discipline des deux personnes), pas un contrôle technique — à ne jamais présenter comme équivalent face à un client ou un auditeur.

**Déclencheur de réévaluation** : dès qu'un client réel (ou une levée de fonds, ou un premier questionnaire de sécurité fournisseur) rend ce risque non négligeable, l'upgrade GitHub Pro (~4$/mois/utilisateur) lève ce blocage immédiatement — coût dérisoire face au risque qu'il couvre. Revoir cette décision à ce moment-là, pas seulement quand "on y pensera".

---

## Étape 1 — Déposer CODEOWNERS

```bash
cp workflow/policies/codeowners.template <chemin-vers-repo-nafar>/.github/CODEOWNERS
```

Remplacer `<handle-cto>` et `<handle-ceo>` par vos identifiants GitHub réels avant de committer.

## Étape 2 — Activer la branch protection sur `main`

Via l'interface GitHub : **Settings → Branches → Add branch protection rule** sur `main`, puis activer :

- ☑ Require a pull request before merging
- ☑ Require approvals — au moins 1
- ☑ Require review from Code Owners
- ☑ Require status checks to pass before merging (une fois la CI en place)
- ☑ Do not allow bypassing the above settings (inclut les admins — sinon la règle ne protège rien le jour où quelqu'un est pressé)
- ☐ Allow force pushes — **désactivé**
- ☐ Allow deletions — **désactivé**

Équivalent en ligne de commande (`gh` CLI, authentifié sur le compte propriétaire du dépôt) :

```bash
gh api \
  --method PUT \
  repos/{owner}/{repo}/branches/main/protection \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": []
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "require_code_owner_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

## Étape 3 — Vérifier que ça bloque réellement

Test à faire une fois, pas à supposer : créer une branche, modifier un fichier sous un chemin HIGH (ex. `src/auth/x.ts`), ouvrir une PR, et confirmer que GitHub refuse le merge tant que `@<handle-cto>` ou `@<handle-ceo>` n'a pas approuvé — même si les tests passent.

## Étape 4 — Répéter par dépôt

Cette configuration est par dépôt GitHub, pas globale à l'organisation (sauf plan GitHub Enterprise avec des *repository rulesets* d'organisation — hors de portée à ce stade). Chaque nouveau dépôt produit RYPHA doit repasser par ce runbook.
