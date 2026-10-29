# 6. La grammaire visuelle

Toutes les vues partagent une même grammaire. Une fiche de vue ne la répète pas ; elle ne décrit que ce qui lui est propre.

## Anatomie d'un écran

| Zone | Rôle | Règle |
|---|---|---|
| **Fil d'Ariane** | la position dans les niveaux de lecture | reflète toujours la hiérarchie système › déployable › composant › élément |
| **Titre** | l'objet de la vue | le nom de l'élément, ou la question de la vue |
| **Bandeau de faits** | la réponse courte à la question de la vue | cinq faits au plus, chacun avec sa forme visuelle ; un fait qui demande attention est bordé de bleu |
| **Onglets** | les représentations alternatives d'un même objet | changer d'onglet ne change pas d'objet |
| **Zone principale** | la représentation | une seule représentation dominante |
| **Panneau latéral** | le détail de l'élément sélectionné | ce qu'il est, ce qu'il implique, où aller ensuite ; repliable |
| **À savoir** | les constats de la vue | rangés par urgence, ouverts à la demande |

## Encodages

| Encodage | Signification |
|---|---|
| **Trait plein** | établi par la lecture |
| **Trait pointillé** | proposé, à confirmer, ou non lu ; jamais décoratif |
| **Bordure bleue** | élément sélectionné, ou fait qui demande attention |
| **Fond bleu nuit** | identité forte : le titre, un état final, une étiquette d'élément |
| **Écrire plus marqué que lire** | une écriture, une mise en file, un appel externe portent plus de poids visuel qu'une lecture |
| **Logo** | la technologie d'un élément, monochrome ; un monogramme quand la marque n'a pas de logo libre |
| **Qualification** | une marque accolée au fait, avec le logo de sa technologie, qui dit ce que cette technologie change : « transaction · rejouée si conflit », « livré au moins une fois », « règle : clients seulement ». Son détail et la documentation qui l'établit s'ouvrent au survol. Un fait dont la technologie n'est pas encore qualifiée porte « non qualifié » |
| **Marques techniques** | un verbe HTTP et sa route, une table, une file, une variable, un nom de code ont chacun leur forme typographique, y compris au milieu d'une phrase |
| **`fichier:ligne`** | la preuve ; un clic ouvre le passage de code en lecture seule, secrets masqués |

Le rouge et le jaune ne sont pas employés : la gravité s'exprime par la position (en premier), la bordure et le libellé, jamais par une alarme colorée.

**Direction du hackathon (20/10/2026).** Les écrans du hackathon emploient un rouge pour un constat et un orange pour un point à surveiller. Ces couleurs ne sont pas des alarmes : elles accompagnent toujours un libellé et la position en tête. Les formes, elles, sont celles du [chapitre 7](07-les-representations.md).

## Interactions

1. **La sélection révèle.** À l'état de repos, une vue montre les éléments sans leurs relations. Sélectionner un élément fait apparaître ses relations et estompe le reste. Une vue ne montre jamais toutes les relations à la fois.
2. **Entrer descend d'un niveau.** Un élément qui a un intérieur s'ouvre par une action explicite (« Entrer dans… »).
3. **La preuve s'ouvre en place.** Une référence de code s'ouvre sans quitter la vue.
4. **L'état de lecture est conservé.** Un panneau replié, un onglet choisi restent tels quels d'une vue à l'autre.

## Composer un écran

Le vocabulaire (les marques, les badges, les logos) dit ce qu'est chaque chose. La composition dit comment les choses se tiennent ensemble. Elle suit six règles.

1. **Une question, une représentation.** La zone principale montre une seule représentation. Les autres façons de voir le même objet sont des onglets, jamais des sections empilées l'une sous l'autre.
2. **Un élément d'une collection est une ligne.** Tout ce qui peut être nombreux (acteurs, routes, tables, tâches, services) est une ligne d'une table groupée, jamais une carte dans une rangée de cartes. Les cartes sont réservées aux faits du bandeau, cinq au plus, et aux fiches du panneau.
3. **Une ligne porte des formes, pas des phrases.** Un nom, des marques, un compte, une barre, une preuve. L'explication d'un élément, avec ses phrases et son code, vient dans le panneau quand on le choisit.
4. **Une dimension n'est mise en colonnes que si elle reste petite sur tout projet.** Les niveaux d'accès, les verbes, les étapes d'un cycle restent en colonnes. Les acteurs, les services, les blocs se comptent par dizaines sur un grand système : ils deviennent un regroupement, un filtre ou un onglet.
5. **Les constats vont dans « À savoir » et sur la ligne concernée.** Jamais dans une section de la zone principale. Une ligne qui porte un constat le dit par une marque, et la table peut ranger ces lignes en premier.
6. **Le même objet a la même forme sur tous les écrans.** Un acteur, une route, une table, une garde se dessinent de la même façon partout où ils apparaissent.

## Tenir à l'échelle

Un écran se dessine d'abord pour un grand système, puis se vérifie sur un petit. La forme ne change pas avec la taille ; seuls le repli et les filtres entrent en jeu.

| Quantité | Ce que fait la table |
|---|---|
| jusqu'à 12 lignes | tout est ouvert, sans regroupement obligatoire |
| plus de 12 lignes | lignes regroupées, groupes ouverts |
| plus de 8 groupes ou 60 lignes | groupes repliés, sauf celui de la sélection et ceux qui portent un constat ; un filtre et une recherche apparaissent dans la barre de la table |
| groupes eux-mêmes nombreux | deux niveaux de regroupement (service, puis ressource) |

Un groupe replié reste lisible : son nom, son compte, une barre de répartition, le nombre de constats qu'il contient. La table annonce toujours ce qu'elle cache (« 34 acteurs · 3 groupes repliés »). Dans le panneau, une liste montre cinq lignes, puis « Voir les N autres ».

Un filtre ne retire pas les lignes : il estompe celles qui ne répondent pas, pour que l'on voie aussi ce qui est refusé.

## Densité

- Au repos, une vue tient en une lecture : un niveau de hiérarchie dominant, peu d'éléments, aucun chevauchement.
- Un texte n'est jamais tronqué ni coupé au milieu d'un mot : l'élément s'agrandit ou passe à la ligne à une jointure.
- Au-delà d'un seuil, une liste se replie et annonce ce qu'elle cache (« voir les 12 autres »).
- Aucune information n'est rendue en texte brut quand elle a une forme : un compte est une tuile, une proportion une barre, une technologie un logo, un effet une marque, une garantie propre à une technologie une qualification.
- Une section propre à une technologie (règles de sécurité, contraintes d'un schéma, réglages d'une file) n'apparaît que pour les éléments qui la portent ; elle n'est jamais remplacée par une case vide chez les autres.
