# Composant

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Quelle responsabilité ce composant porte-t-il, et pour qui ? | composant | un nœud `component`, ses fonctions (`CodeFunction`), leurs appelants et leurs effets | maquettée (B3) |

## 1. Objet

Un composant ouvert : son **interface de fait** (les fonctions appelées depuis l'extérieur du composant), son **implémentation** (les fonctions qu'il garde pour lui), ses **appelants**, ses **effets** (lectures, écritures, appels externes), ses **refus** (les erreurs qu'il lève et leur condition), et la connaissance déclarée ancrée dans ses fichiers.

## 2. Fondement

Un composant partagé se comporte comme un module avec un contrat implicite : ce qu'il offre, ce qu'il garantit, ce qu'il refuse. Ce contrat n'est écrit nulle part ; la vue le reconstitue à partir des appels réels. C'est le niveau où se vérifient les **invariants** d'une capacité (un débit ne rend jamais un solde négatif, une opération est atomique) et où se mesure la **surface de changement** (qui appelle chaque fonction offerte).

## 3. Ce que la vue établit

- L'interface effective du composant, chaque fonction avec le nombre de points d'entrée qui l'utilisent.
- Les effets de chaque fonction offerte, dans l'ordre, et les conditions de ses refus.
- L'usage de mécanismes de cohérence (transaction, verrou, clé d'idempotence) quand le code les emploie.
- Les règles déclarées qui portent sur le composant, et leur état contre le code.

## 4. Représentation

Les fonctions offertes, ordonnées par nombre d'appelants, chacune avec les composants qui l'appellent et ce qu'elle touche ; un point d'entrée écrit dans le composant ferme la liste. Puis les fonctions internes, en retrait. Une fonction sélectionnée montre ses étapes numérotées, fonctions internes dépliées, encadrées par le mécanisme de cohérence qui les contient (une transaction), à côté de son code. Le panneau donne les lignes qui l'appellent avec leur point d'entrée, les garanties lues dans le composant (transactions, clés d'idempotence), le commentaire de l'auteur en tête de fichier cité ligne à ligne, et les notes ancrées.

## 5. Sources et technologies

Le composant calculé, les fonctions du dépôt avec leurs appels (`calls`, `calledFrom`) et leurs déroulés, le commentaire d'ouverture de ses fichiers, la connaissance déclarée. Les garanties (transaction, clé d'idempotence) et le commentaire d'ouverture ne sont pas encore lus par le moteur pour un composant calculé.

**Ce qui dépend de la technologie.** Les garanties lues dans un composant sont nommées avec la technologie qui les fournit : une transaction d'un stockage documentaire n'a pas les propriétés d'une transaction relationnelle, une clé d'idempotence n'empêche un double effet que si le stockage refuse une deuxième création. Chaque garantie est montrée avec ce que sa technologie implique.

## 6. Limites

La raison d'être du découpage n'est pas lue : c'est une décision, qu'une note peut porter. Un appel dynamique (par réflexion, par nom construit) n'est pas compté.

## 7. Relations

Depuis l'[Intérieur d'un bloc](interieur-d-un-bloc.md) ; vers [Code](code.md) pour une fonction ; vers [Impact](impact.md) pour la portée d'un changement ; vers [Connaissance](connaissance.md) pour une note.
