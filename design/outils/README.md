# Contrôler une planche avant de la montrer

Le panneau navigateur de Claude ne peut pas ouvrir les canevas : il est connecté à un autre compte. Ces trois fichiers rendent une planche `.dc.html` en local et la contrôlent. Règles suivies : chapitre 7, section 0, de [lire le système](../../docs/lire-le-systeme/grammaire/07-les-representations.md).

| Fichier | Rôle |
|---|---|
| `render.py` | Transforme une planche en page HTML ordinaire : `python3 render.py <planche.dc.html> <sortie.html>`. La page attend `../tools/dc-stub.js` et `../ds/project/components/bundle.css` à côté d'elle. |
| `dc-stub.js` | Un substitut minimal du moteur des planches : les trous `{{chemin}}`, `<sc-for>`, `<sc-if>` et les gestionnaires d'évènements. Rien d'autre. |
| `check.js` | Exécuté dans la page rendue, il rend sa hauteur et la liste de ses défauts : texte coupé ou qui déborde, éléments qui se chevauchent, cadres qui défilent. |

## Marche à suivre

1. Copier la planche, `bundle.css` du design système et ces outils dans un dossier servi en HTTP, par exemple avec `python3 -m http.server`.
2. Rendre la planche avec `render.py`, l'ouvrir et exécuter `check.js` dans la console : la liste des défauts doit être vide.
3. Faire une capture en pleine résolution, à la largeur de la planche (Brave ou Chrome en mode headless, `--screenshot`), et la regarder de près.

`check.js` ne voit ni le texte placé en position absolue, ni le texte dessiné en SVG : c'est la raison de l'étape 3.
4. Reporter la hauteur mesurée dans le `$preview` de la planche et dans `canvas.json`.
