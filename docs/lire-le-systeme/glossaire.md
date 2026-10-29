# Glossaire

**Ancrage** — Lien entre une note déclarée et le code qui la porte (fonction, symbole, repère). Permet de recalculer l'état de la note à chaque analyse.

**Arête** — Échange typé entre deux nœuds : `call`, `read`, `write`, `message`, `request`, `trigger`, `use`, `deploy`. Porte son nombre d'occurrences et leurs preuves.

**Composant** — Ensemble de fichiers d'un même déployable qui s'appellent entre eux et servent exactement les mêmes points d'entrée. Calculé (`proposed`), sauf s'il est défini par un contrat lu dans le code.

**Composant partagé, propre, socle** — Classification d'un composant selon les points d'entrée qu'il sert : un seul groupe d'entrée (*propre*), plusieurs (*partagé*), au moins les trois quarts des entrées du déployable (*socle*).

**Constat** — Motif reconnu dans les faits qui désigne une fenêtre de risque (route sans garde, lecture puis écriture sans protection). N'affirme pas un défaut.

**Contrat** — Interface du code réalisée par plusieurs implémentations interchangeables, avec le mécanisme qui choisit l'implémentation.

**Couverture** — Mesure du périmètre lu (fichiers, manifestes, appels) et des raisons de chaque lacune.

**Déployable** — Unité déployée et lancée séparément : app, service, fonction, worker, tâche, binaire.

**Déroulé** — Suite typée de ce qu'exécute le code d'un point d'entrée ou d'une fonction : lecture, écriture, message, appel, refus, retour, réponse.

**Facette** — Aspect générique d'un nœud du modèle neutre : `entrypoints`, `data`, `contract`, `channel`, `config`, `trust`, `functions`, `component`. Une vue se définit sur des facettes.

**Fait** — Affirmation sur le système accompagnée de sa preuve et de sa source.

**Garde** — Contrôle d'accès d'un point d'entrée : public, authentifié, rôle, signature, interne, non reconnu.

**Lecture transversale** — Vue qui rassemble, à travers les niveaux, les éléments produisant une propriété du système (concurrence, défaillance, données personnelles, impact).

**Modèle neutre** — Représentation du système commune à tous les projets : niveaux, catégories de faits, facettes. Sa forme ne nomme aucune technologie ; chaque fait y garde la technologie qui le produit et la qualification que son pack lui donne.

**Niveau de lecture** — Échelle de description : système, déployable, composant, point d'entrée, code.

**Note** — Connaissance déclarée par un humain ou un agent : règle, invariant, décision, garantie… Ancrée, et dotée d'un état (vérifiée, à jour, à relire, contredite, introuvable, sans ancrage).

**Pack** — Encodage de la spécification d'une technologie : il reconnaît ses formes (une route, une table, une tâche) et les range dans les catégories communes, et il porte sa sémantique (ce qu'elle garantit, ce qu'elle laisse au code, ses modes d'échec).

**Qualification** — Ce qu'un pack ajoute à un fait d'après la sémantique de sa technologie : une transaction rejouée en cas de conflit, un événement livré au moins une fois, une règle d'accès qui ne s'applique qu'aux clients.

**Point d'entrée** — Porte d'exécution du système : route, fonction appelable, tâche planifiée, consommateur de file, événement reçu, programme principal, commande.

**Portée d'un point d'entrée** — Ensemble des fonctions et fichiers que son code exécute, suivi d'appel en appel à l'intérieur du déployable.

**Preuve** — Fichier et ligne qui établissent un fait, avec la source qui l'a produit.

**Source** — Origine d'un fait : `syntax`, `symbols`, `manifest`, `pack`, `declared` ; `runtime` est prévue.

**Statut** — Nature d'un élément : `extracted` (lu), `proposed` (calculé par une règle), `declared` (écrit par un humain ou un agent).

**Vue** — Coupe du modèle qui répond à une question, à un niveau donné.
