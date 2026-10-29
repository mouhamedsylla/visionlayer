# Critères de décision

Fixés le 29/09/2026, **avant le premier passage**. Ils ne changent plus une fois les chiffres vus (doc 04 §11.7). Si une hypothèse tombe, on corrige la livraison et on rejoue, sans toucher à ce fichier.

## Ce qu'on compte

- **Passage réussi sur la nuance** : l'oracle du scénario donne `task` et `nuance` vrais. Un passage qui ne fait rien n'est pas une réussite, même si rien n'est cassé.
- **Régression** : un test du dépôt qui passait au départ ne passe plus. Un passage avec régression compte comme raté.
- **Tokens** : l'entrée, la sortie, la lecture de cache et l'écriture de cache, comptées séparément ; le total est leur somme. On compare des médianes par case (scénario × condition).
- Les résultats sont donnés en comptes (« 4 sur 5 »). Un écart d'un passage n'est pas un résultat.

## Seuils

**H1, compréhension.** Validée si, sur les scénarios à nuance (S1 à S6) :
- C réussit la nuance dans au moins 80 % des passages ;
- C fait au moins 30 points de mieux que A ;
- aucun scénario n'a C en dessous de A.

**H2, économie.** Validée si :
- à taux de réussite au moins égal, le total médian de tokens de C est au plus 70 % de celui de A ;
- sur le témoin S7, C ne coûte pas plus de 10 % de plus que A.

**H3, réduire sans perdre.** Validée si :
- C est à moins de 10 points de D sur les nuances ;
- C coûte au plus 70 % de D.

## Calibrage

Il se fait pendant le pilote, avant la campagne : la condition A passe trois fois sur chacun des sept scénarios. Un scénario que A réussit 3 fois sur 3 ne mesure pas H1, parce que la nuance se lit dans le code. Il sort du calcul de H1 et reste comme témoin. Le retrait est écrit dans le doc 05.
