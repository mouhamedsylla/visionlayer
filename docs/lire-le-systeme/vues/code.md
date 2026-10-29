# Code

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Quelle ligne établit ce fait ? | code | facette `functions` : `CodeFunction`, son déroulé, ses appelants, ses appels | codée (maquette 10) |

## 1. Objet

Les fonctions de premier niveau du dépôt, par déployable et par fichier, qui produisent un effet visible ou sont appelées ailleurs. Une fonction ouverte : ses étapes numérotées, son code en lecture seule annoté des numéros d'étapes, ses appelants (avec la fonction qui contient chaque appel) et ses appels (avec leur résolution dans le dépôt).

## 2. Fondement

C'est le niveau terminal du zoom et le lieu de la preuve : tout fait des autres vues s'y résout. La vue lit le code **comme un déroulé** plutôt que comme un texte, pour qu'une fonction se comprenne sans lire tout son fichier, et rattache chaque ligne au niveau supérieur (point d'entrée porté, composant d'appartenance).

## 3. Ce que la vue établit

- Ce qu'une fonction fait, dans l'ordre, et ses refus.
- Ses appelants et le point d'entrée qu'elle porte le cas échéant.
- Les fonctions les plus appelées, souvent le cœur d'un composant partagé.

## 4. Représentation

Une liste par déployable et fichier ; une fonction ouverte en trois zones : étapes, code, voisinage. Le code long se lit par passages de quatre-vingts lignes.

## 5. Sources et technologies

L'arbre syntaxique des fichiers lus, la résolution des appels entre fichiers.

**Ce qui dépend de la technologie.** La vue ne dépend pas de la sémantique d'une technologie : elle montre le code lu. Les étapes qu'elle numérote gardent la qualification donnée par les packs.

## 6. Limites

La vue n'affirme jamais qu'une fonction n'est pas appelée ou pas exportée : elle dit ce qui a été lu. Les méthodes de classe ne sont pas encore ouvertes seules. Les fichiers de test ne comptent pas comme appelants.

## 7. Relations

Vers [Composant](composant.md), [Impact](impact.md), [Points d'entrée](points-d-entree.md).
