# L'interface de VisionLayer

Recodée depuis les maquettes du canevas « VisionLayer — tous les écrans », sur le modèle neutre ([ADR 0018](../docs/decisions/0018-nouvelle-interface.md)). L'ancienne interface est archivée dans [archive/ui-v1](../archive/ui-v1) ; rien n'en est repris.

```bash
pnpm run ui:build
```

```bash
pnpm run ui tests/corpus/atelier-api
```

En développement, `pnpm run ui:dev` sert l'interface (port 5173) et renvoie `/api` vers `vision ui` (port 4173).

## Où est quoi

| Dossier | Rôle |
|---|---|
| `src/app/` | l'application : la liste des écrans, la route courante (`#/architecture`) |
| `src/api/` | le contrat HTTP (types importés du moteur), le client, le chargement de la carte |
| `src/theme/` | les couleurs, polices et rayons : le seul endroit où une couleur est écrite |
| `src/shell/` | la coquille commune : barre latérale, barre du haut |
| `src/components/` | les petits éléments partagés : bouton, étiquette, référence `fichier:ligne`, bandeau d'écran, panneau de droite, passage de code |
| `src/domain/` | les calculs, en fonctions pures, un dossier par écran : couloirs, liens, mise en page, effets d'un point d'entrée, accès aux tables |
| `src/screens/<écran>/` | un écran : des composants qui affichent ce que `domain/` calcule |
| `tests/` | tests de `domain/` et rendu des écrans, sur la carte d'atelier-api |

## Règles

Elles sont vérifiées par [tests/ui-boundaries.test.ts](../tests/ui-boundaries.test.ts) :

- un fichier ne dépasse pas 150 lignes ;
- aucune couleur hors de `theme/tokens.css` ;
- une feuille de style par composant (`*.module.css`) ;
- rien n'est importé de l'archive.

Un écran n'affiche que ce que la carte contient. Quand une maquette montre une donnée que le modèle n'a pas encore, l'écran attend la donnée au lieu de l'inventer.
