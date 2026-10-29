# Knowledge layer — 2. Le modèle de connaissance

**Statut :** brouillon de réflexion. Ce document décrit **ce qu'il faut représenter** et **comment en garder la vérité**. Il ne fixe ni le format de fichier, ni l'arborescence `.vision/`, ni la syntaxe. Ces choix viendront après un prototype.
**Prérequis :** [01-ce-que-visionlayer-doit-savoir.md](./01-ce-que-visionlayer-doit-savoir.md).

## Vocabulaire de ce document

| Mot | Sens ici |
|---|---|
| **Symbole** | Un élément nommé du code : fonction, méthode, classe, type, constante exportée. |
| **Arbre syntaxique** (AST) | La structure du code telle que le compilateur la comprend, indépendamment des espaces, des retours à la ligne et des commentaires. VisionLayer l'utilise déjà (`vision/arch/ast.ts`). |
| **Concept** | Une chose du système qui a un sens pour un humain : une feature, un flux, un contrat, une entité de données, un bloc, une décision. |
| **Affirmation** | Une phrase de connaissance sur un concept (« un exercice hors programme n'est jamais servi »), avec ses ancrages et son état. C'est l'unité de base du modèle. |
| **Ancrage** | Le lien entre une affirmation et le code qui la réalise : un symbole, éventuellement une partie précise (une branche). |
| **Point de référence** | Le commit où l'affirmation a été écrite ou reconfirmée pour la dernière fois. Elle est vraie *à ce commit-là*. |
| **Provenance** | Qui a produit l'information : extraite, commentaire du développeur, agent, humain, revue en PR. |

## Les principes

1. **L'affirmation est l'unité, pas le fichier.** Un fichier de connaissance n'est qu'un rangement ; on doit pouvoir changer de rangement sans rien perdre.
2. **Le code gagne toujours.** Un fait extrait l'emporte sur une affirmation. Un écart est montré, jamais masqué.
3. **Rien de périmé n'est affiché comme vrai.** Une affirmation dont le code ancré a changé apparaît avec son état (« à reconfirmer »), pas comme une vérité.
4. **Pas de redite.** Une affirmation ne décrit jamais ce que VisionLayer extrait (imports, appels, types, données lues et écrites…).
5. **Tout est ancré.** Une affirmation sans ancrage n'est acceptée que pour ce qui n'a pas de code (une hypothèse sur un service externe, un choix de projet cloud), et elle est affichée comme telle.
6. **Identifiants stables.** Un concept et une affirmation gardent leur identifiant quand le code est renommé ou déplacé. L'identifiant n'est jamais tiré d'un chemin de fichier.
7. **Rien de technique dans ce qu'on relit.** Un humain qui relit une PR ne doit voir que de la prose et des ancrages lisibles, pas d'empreintes ni de hash.

---

## 1. Les objets du modèle

### Concept
- **Identifiant** stable, par domaine : `awa.exercise-selection`, `video.create`, `access.code`.
- **Type** : `feature`, `flow`, `contract`, `entity`, `block`, `decision`, `term` (mot du métier).
- **Nom** lisible.
- **Liens déclarés** vers d'autres concepts (voir §4).

Un concept déclaré peut correspondre à un objet que VisionLayer a extrait : un bloc de la carte, une entité (collection, table), une interface avec implémentations. Dans ce cas il est **rattaché** à cet objet et ne fait que l'enrichir. Une feature, en revanche, n'existe que parce qu'elle est déclarée : VisionLayer ne connaît que des points d'entrée.

### Affirmation
| Champ | Rôle |
|---|---|
| identifiant | stable, unique dans le projet (`video.render.reply-200-on-failure`) |
| concept | le concept auquel elle appartient |
| type | voir §2 |
| texte | une à trois phrases courtes, en langage courant |
| ancrages | un ou plusieurs (voir §3) ; zéro seulement pour les types sans code |
| provenance | agent (quel agent, quelle session), humain, et « revue » si relue en PR |
| point de référence | calculé par VisionLayer à partir de Git, jamais écrit à la main |
| état | calculé à chaque scan (voir §5) |

### Ancrage
- **Symbole** : fichier et nom qualifié (`selectExercise`, `VideoService.render`), résolu par l'extracteur.
- **Partie** (facultatif) : une branche, une boucle, une plage du symbole. C'est le point délicat : ces parties n'ont pas de nom (voir §6).
- **Rôle** (facultatif) : pour un invariant, distinguer l'endroit qui le **fait respecter** des endroits qui **en dépendent**.

---

## 2. Les types d'affirmation

Chaque type répond à une dimension du document 1, dit ce qu'il doit ancrer, et comment VisionLayer le vérifie. Un type **sans vérification possible** n'est suivi que par le changement de son code.

Les exemples illustrent la forme attendue. Seul « on répond 200 » est vérifié dans Nafar ; les autres restent à confirmer par le prototype.

| Type | Répond à | Ancrage | Vérification par VisionLayer | Exemple |
|---|---|---|---|---|
| `purpose` | A1 le but | symbole, bloc ou concept | aucune (suivi du changement) | « Sélectionner un exercice adapté à l'état pédagogique actuel de l'élève. » |
| `rule` | A9 règle métier | l'endroit qui l'applique | l'ancrage est bien une condition, un garde, un filtre | « Un script n'est généré qu'une fois par réponse. » |
| `invariant` | A9 invariant | l'endroit qui le fait respecter, et ceux qui en dépendent | l'ancrage est un garde, un `throw` ou un filtre ; les tests qui l'atteignent (§4) | « Un exercice hors du programme actif n'est jamais renvoyé. » |
| `step` | A7 flux | une partie d'un symbole | l'ancrage est dans le flux ; l'ordre des étapes suit celui du code | « Filtrer les exercices compatibles avec le programme. » |
| `why` | A20 pourquoi d'une branche | une branche | l'ancrage est bien une branche | « On répond 200 pour que Cloud Tasks ne réessaie pas en boucle. » |
| `failure` | A10 pannes | une branche d'erreur, un `catch`, un retour | l'ancrage est bien un chemin d'erreur | « Opération idempotente : une nouvelle tentative ne crée pas de second job. » |
| `guarantee` | A8 contrat | l'interface, ou une méthode | l'interface existe ; chaque implémentation est listée | « Toute implémentation renvoie un résultat partiel plutôt que de lever une erreur si le modèle coupe. » |
| `state-meaning` | A6 cycle de vie | l'écriture de l'état | l'état est bien écrit dans le code | « `failed` : le rendu a échoué, l'élève peut relancer. » |
| `assumption` | A14 hypothèse externe | facultatif | aucune ; toujours affichée « hypothèse » | « Cloud Tasks réessaie toute réponse non 2xx. » |
| `decision` | A20 décision | le code qu'elle contraint, ou un ADR | l'ancrage existe | « Une file plutôt qu'un appel direct : le rendu dépasse le délai d'une Function. » |
| `limit` | A20 limite connue | le code concerné | l'ancrage existe | « Pas de reprise d'un rendu interrompu. » |
| `term` | A2 vocabulaire | facultatif | aucune | « Maîtrise : score par chapitre, de 0 à 1. » |

Cette liste est un point de départ. Elle sera **réduite** après le prototype si certains types ne servent à aucun écran. Chaque type doit être justifié par une question du document 1.

---

## 3. Déclaré et observé

VisionLayer construit son modèle en superposant deux couches :

```text
code, manifestes, config, Git, tests  →  faits extraits (squelette, toujours vrais)
knowledge layer                      →  affirmations déclarées (sens)
                                          ↓
                            modèle de VisionLayer, chaque élément avec sa provenance
```

Quand une affirmation parle de quelque chose que VisionLayer peut observer, il compare :

| Déclaré | Observé | Ce qui est montré |
|---|---|---|
| la feature `video.create` entre par `videoCreate` | `videoCreate` existe et c'est un point d'entrée | la feature, avec tout ce que ce point d'entrée atteint (calculé, pas déclaré) |
| l'invariant est appliqué ici | l'ancrage n'est plus un garde (la condition a été supprimée) | « contredit » |
| la feature touche `exercises` | aucune lecture de `exercises` atteinte | écart signalé (et on conseille de ne pas déclarer ce qui s'extrait) |
| « on répond 200 en cas d'échec » | le `catch` renvoie 500 | « contredit » |
| un commentaire dit le contraire du code | (cas `render-core.ts` / `service.ts:91`) | écart signalé, même sans knowledge layer |

**Les tests.** Pour un invariant ou une règle, VisionLayer cherche les tests dont les appels **atteignent** l'ancrage (graphe d'appels depuis les fichiers de test). Le libellé est honnête : « atteint par 3 tests », jamais « prouvé par », car atteindre un code ne prouve pas qu'on vérifie la propriété. Un test qui cite l'identifiant de l'invariant (dans son nom ou une étiquette) est affiché « testé explicitement ». « Aucun test n'atteint ce garde » est un signal utile en revue.

---

## 4. Les liens entre concepts

Déclarés seulement quand ils ne peuvent pas être calculés :

- **feature → points d'entrée** : obligatoire, c'est ce qui définit la feature. Le reste (fonctions, données, IA, files atteintes) est **calculé** par fermeture depuis ces points d'entrée.
- **feature → feature** : « fait partie de », « nécessite ».
- **invariant → entité** : « protège l'entité `exercises` ».
- **contrat → concept** : pour un contrat qui n'est pas une interface du code (une convention entre l'app et une Function).
- **décision → ADR** : quand la décision est déjà écrite ailleurs, on la relie, on ne la recopie pas.

L'appartenance d'un symbole à une feature n'est **pas** déclarée symbole par symbole : elle se calcule. On ne la déclare que pour un code atteint par plusieurs features, quand on veut dire lequel il sert vraiment.

---

## 5. Garder la vérité

### Le point de référence
Une affirmation est vraie **au commit où elle a été écrite ou reconfirmée**. VisionLayer retrouve ce commit dans l'historique Git du fichier de connaissance. Pour le travail pas encore commité, la référence est l'état de la session en cours.

À chaque scan, VisionLayer compare le code de chaque ancrage **entre le point de référence et maintenant** :
- la comparaison se fait sur l'**arbre syntaxique normalisé** (sans espaces, retours à la ligne ni commentaires) : un reformatage ne périme rien ;
- elle se fait **à la granularité de l'ancrage** : un invariant ancré sur une branche ne périme que si cette branche change, pas toute la fonction. Sans cela, tout serait « à reconfirmer » en permanence et plus personne ne regarderait.

Avantage de ce choix : aucune empreinte technique n'est écrite dans les fichiers de connaissance (principe 7). Git est la source de vérité sur le « quand ».

### Les états
| État | Condition | Affiché dans les écrans |
|---|---|---|
| **vérifié** | la vérification du type a réussi et le code n'a pas changé | comme vrai, avec sa provenance |
| **à jour** | pas de vérification possible, mais le code ancré n'a pas changé | comme vrai, marqué « déclaré » |
| **à reconfirmer** | le code ancré a changé depuis le point de référence | barré ou atténué, avec le diff qui l'a rendu incertain |
| **contredit** | la vérification échoue (plus de garde, code de retour différent) | en alerte, avec les deux côtés |
| **orphelin** | l'ancrage est introuvable | seulement dans une liste « connaissance orpheline » |
| **non ancré** | type sans code (`assumption`, `term`) | marqué « hypothèse » ou « définition » |

**Reconfirmer** coûte une action : l'auteur dit « toujours vrai » (ou corrige le texte), le point de référence avance au commit courant.

---

## 6. Déplacements, renommages, découpages

À chaque scan, VisionLayer résout chaque ancrage dans cet ordre :

1. **Même fichier, même nom** : trouvé. On passe à la comparaison du §5.
2. **Même code ailleurs** : le symbole n'est plus là, mais un symbole à l'arbre normalisé identique existe (autre nom, autre fichier ; le renommage de fichier est aussi détecté par Git) : l'ancrage est relocalisé, l'affirmation reste valide, affichée « déplacé ».
3. **Code proche ailleurs** : forte ressemblance, ou symbole créé dans la même session d'agent qui a supprimé l'ancien : candidat proposé, affirmation « à reconfirmer ».
4. **Découpé** : l'ancien symbole est devenu plusieurs. L'affirmation peut porter plusieurs ancrages ; en attendant, « à reconfirmer ».
5. **Introuvable** : « orphelin ».

**Le cas des parties sans nom.** Une étape ou une branche n'a pas de nom stable. Deux options, à trancher par le prototype :

| Option | Principe | Pour | Contre |
|---|---|---|---|
| Position dans l'arbre | « la 2ᵉ condition de `selectExercise` » | rien dans le code | casse dès qu'on insère une condition avant |
| Marqueur minimal dans le code | un identifiant seul, sans texte : `// @k video.render.reply-200-on-failure` | survit à tous les refactorings, visible dans le diff | une ligne dans le code |

Recommandation provisoire : le **marqueur minimal**, réservé aux parties sans nom. Il ne contient jamais de prose : le sens reste dans le knowledge layer. C'est très loin de « commenter massivement pour VisionLayer ».

---

## 7. Le cycle dans le travail des agents

Tout reste dans le cadre de l'option A et de l'[ADR 0013](../decisions/0013-visionlayer-control-tower-and-agent-integration.md) : VisionLayer ne lance jamais d'agent ; le serveur MCP reste en lecture seule ; les agents écrivent des fichiers du repository, relus dans la PR.

1. **Avant de modifier du code.** `vision_context` renvoie pour les fichiers visés :
   - les affirmations existantes, d'abord les **invariants et règles**, qui disent à l'agent ce qu'il ne doit pas casser ;
   - celles qui sont à reconfirmer ou contredites ;
   - les manques (un point d'entrée qui n'appartient à aucune feature).
2. **Juste après une modification** (hook `PostToolUse`, réponse d'information, jamais bloquante) : « tu viens de modifier la branche ancrée par `video.render.reply-200-on-failure` : reconfirme ou mets à jour ».
3. **Quand écrire** : seulement dans ces cas-là.
   - Nouvelle feature ou nouveau point d'entrée.
   - Nouvelle règle ou nouvel invariant, ou un invariant existant dont on dépend sans qu'il soit écrit.
   - Branche dont le pourquoi n'est pas évident, en particulier un chemin d'erreur.
   - Nouvel état d'une entité.
   - Décision avec une alternative écartée.
   - Hypothèse sur un service externe.
4. **Fin de tâche** (hook `Stop`, une fois) : rappel de ce qui est resté à reconfirmer dans ce qui a été touché.
5. **Dans la PR** : section « Connaissance » du rapport, avec ce qui est ajouté, reconfirmé, à reconfirmer, contredit, orphelin, manquant. Une affirmation relue et fusionnée prend la provenance « revue ».

**Mesure de la charge.** Le prototype doit mesurer le nombre d'affirmations par modification, et le temps ou les tokens qu'elles coûtent. Cible : zéro à trois par modification, rien pour un helper trivial.

---

## 8. Ce qui n'est pas décidé

| Sujet | Options | Critère pour trancher |
|---|---|---|
| Rangement | miroir par fichier source ; un fichier par concept ; les deux (notes de symbole en miroir, concepts à part) | ce qui est le plus simple à tenir pour l'agent, et le plus lisible en PR |
| Format | YAML ; Markdown avec en-tête ; autre | lisibilité en revue, facilité de validation |
| Ancrage des parties | position dans l'arbre ; marqueur minimal | taux de survie aux refactorings pendant le prototype |
| Types d'affirmation | la liste du §2, réduite | chaque type doit servir au moins un écran |
| Humains | même format, provenance distincte ? | usage réel |
| Langue | celle du projet ; toujours la même | lecteurs du projet |

Quel que soit le rangement, VisionLayer **calcule** l'index (qui relie concepts, affirmations, symboles et états) et ne le committe pas. Le rangement est donc remplaçable.

---

## 9. Le prototype, et comment on saura qu'il marche

**Périmètre :** deux features de Nafar, sur une branche à part de learn-app (avec l'accord du propriétaire) :
- la création vidéo (asynchrone, file, IA, pannes) ;
- l'échange de code d'accès (autorisation, règle métier).

**Méthode :** écrire leurs affirmations à la main, dans un format jetable. Brancher VisionLayer dessus en lecture. Puis faire un vrai refactoring et une vraie modification de comportement, et observer.

**Critères de réussite :**
1. Les écrans Feature, Données et « comment ça marche » répondent aux questions de la partie B du document 1 pour ces deux features, sans rien de faux affiché comme vrai.
2. Après un renommage ou un déplacement, les ancrages sont retrouvés sans intervention.
3. Après un changement de comportement, les affirmations concernées passent à « à reconfirmer » ou « contredit », et seulement celles-là.
4. Le nombre d'affirmations écrites reste petit ; aucune ne répète un fait extrait.
5. Un agent qui reçoit ces affirmations avant de coder évite de casser l'invariant concerné.

Seulement ensuite : le format définitif, l'arborescence, la consigne pour `CLAUDE.md` / `AGENTS.md`, et un ADR 0014.
