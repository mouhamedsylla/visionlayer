# ADR 0018 — Une nouvelle interface, recodée depuis les maquettes, sans rien reprendre de l'ancienne

**Statut :** Accepté le 02/10/2026. Remplace la partie interface de l'[ADR 0008](./0008-ui-read-only-react-flow-elk.md). Suit l'[ADR 0017](./0017-modele-neutre.md) §8, étape 4.

## Contexte

L'ancienne interface (`ui/` et son serveur `vision/ui/server.ts`) lisait la carte version 1, née sur un projet réel. Elle avait grandi écran par écran, et certains fichiers dépassaient 500 lignes. La passer au modèle neutre aurait demandé de toucher presque chaque fichier. Les oublis auraient été inévitables : un ancien style, un ancien champ, un écran à moitié migré.

Les écrans à construire existent déjà. Ce sont les maquettes du canevas « VisionLayer — tous les écrans », refaites le 30/09 pour n'importe quel projet, sur l'exemple d'atelier-api.

## Décision

1. **L'ancienne interface est archivée**, telle quelle, dans [archive/ui-v1/](../../archive/ui-v1). Elle n'est plus construite, typée ni testée. Rien n'en est importé : ni composant, ni style, ni utilitaire ([tests/ui-boundaries.test.ts](../../tests/ui-boundaries.test.ts) le vérifie).
2. **Une nouvelle interface est écrite dans [ui/](../../ui)**, écran par écran, depuis les maquettes. Elle ne lit que le modèle neutre.
3. **Un nouveau serveur local, [vision/web/](../../vision/web)**, ne fait que quatre choses :
   - `GET /api/project` donne le nom du dépôt et le commit lu (Git local) ;
   - `GET /api/map` donne la carte v2, calculée au démarrage puis gardée en mémoire ;
   - `POST /api/map/refresh` relance l'analyse, sur le clic « Mettre à jour l'analyse » ;
   - `GET /api/source` donne un passage (80 lignes au plus) d'un fichier que la carte cite ; un fichier d'environnement ou hors du dépôt est refusé, une valeur qui ressemble à un secret est masquée (ajouté le 02/10 pour l'écran Données).

   Il n'écrit aucun fichier et n'écoute que `127.0.0.1`.
4. **Des règles de code, vérifiées par un test :**
   - aucun fichier de `ui/src` ne dépasse 150 lignes ;
   - les couleurs ne sont écrites qu'une fois, dans `ui/src/theme/tokens.css` ;
   - chaque composant a sa propre feuille de style (CSS Modules) : il n'y a pas de feuille globale partagée, hormis le thème ;
   - les calculs (couloirs, liens, mise en page, chiffres du bandeau) sont des fonctions pures dans `ui/src/domain/`, testées sans navigateur ; les composants ne font qu'afficher.
5. **Un écran non recodé reste grisé** dans la barre latérale. Aucun écran n'affiche une donnée que le modèle ne contient pas : une partie de maquette sans donnée attend la donnée (par exemple le style d'architecture « confirmé par MS », ou la tâche en cours dans le workflow).

## Conséquences

- L'interface n'a pour l'instant qu'un écran, Architecture. Les autres suivent l'ordre des maquettes.
- Les écrans qui dépendaient des actions de l'ancien serveur (scan, connaissance, activité des agents, création de projet) reviendront avec leurs propres routes, chacune dans son fichier de `vision/web/`.
- `vision scan`, `archi`, `cost` et `knowledge` lisent encore la carte version 1. Ils partent à l'étape 5 de l'ADR 0017.
