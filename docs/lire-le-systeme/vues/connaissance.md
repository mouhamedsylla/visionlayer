# Connaissance

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Que sait-on que le code n'exprime pas, et est-ce encore vrai ? | suivi | rapport de connaissance : concepts, affirmations, ancrages, états | maquettée (14) |

## 1. Objet

Les notes déclarées par les humains et les agents dans `.vision/knowledge/`, organisées par concept (fonctionnalité, flux, contrat, entité, bloc, décision, terme), chacune typée (raison d'être, règle, invariant, étape, justification, défaillance, garantie, signification d'un état, hypothèse, décision, limite, terme), ancrée sur le code qui la porte, et son état recalculé contre le code courant.

## 2. Fondement

Voir [principe 4](../principes/04-faits-et-connaissance.md). La connaissance déclarée porte l'intention ; son ancrage la confronte en permanence au code. C'est la seule source qui permet de détecter qu'une **règle attendue n'est pas appliquée**, et non seulement de constater ce que le code fait.

## 3. Ce que la vue établit

- Les règles, invariants et décisions du système, et leur état.
- Les notes à relire après un changement du code ancré.
- Les notes contredites par leur vérification.
- Les points d'entrée qu'aucune fonctionnalité déclarée ne couvre.

## 4. Représentation

Les concepts et leurs notes, chaque note avec son type, son état et son ancrage ; la comparaison entre le code au moment de l'écriture et le code courant pour une note à relire.

## 5. Sources et technologies

Les fichiers de `.vision/knowledge/`, la résolution des ancrages dans le code, l'historique Git pour le point de référence de chaque note.

**Ce qui dépend de la technologie.** La vue ne dépend pas d'une technologie : une note s'ancre dans le code, quelle que soit sa pile.

## 6. Limites

Une note n'est pas plus vraie que son auteur ; son état ne mesure que sa cohérence avec le code ancré.

## 7. Relations

Vers [Composant](composant.md) et [Points d'entrée](points-d-entree.md) pour le code ancré ; vers [Couverture](couverture.md).
