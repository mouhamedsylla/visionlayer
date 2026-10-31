# Un pack écrit par Muse Spark : cookie-parser

Le 31/10/2026, Muse Spark 1.3 a écrit le pack de `cookie-parser`, la seule bibliothèque d'atelier-api que les packs livrés ne lisaient pas. Il est parti de la fiche ([fiche.md](fiche.md)) et de la documentation de la bibliothèque ([doc-cookie-parser.md](doc-cookie-parser.md)), sans voir le projet. Le pack final est [cookie-parser.yaml](cookie-parser.yaml).

```
pnpm packs write cookie-parser <projet> --doc doc-cookie-parser.md
```

## Les trois essais

Chaque essai a fait corriger la fiche, jamais le pack à la main.

| Essai | Ce que la fiche disait de plus | Échanges | Coût, durée | Ce que le pack affirme sur atelier-api | Jugement |
|---|---|---|---|---|---|
| 1 | le vocabulaire de faits, dont `trust` | 9 | 0,20 $, 217 s | `api` reconnaît ses appelants par **signed-cookie** (`app.ts:34`, le montage avec un secret) | **Faux.** `session.ts` lit `req.cookies.sid`, et le cookie est posé sans `signed: true` : la signature n'est jamais vérifiée. Le pack passait pourtant ses tests : il prenait le montage pour l'emploi |
| 2 | « installé n'est pas employé » : `trust` est la ligne qui lit la preuve, pas celle qui monte l'outil | 8 | 0,24 $, 205 s | `api` reconnaît ses appelants par **cookie** (`session.ts:22`) | Juste. Mais les utilitaires `JSONCookie` comptaient comme une preuve |
| 3 | une valeur lue hors d'une garde peut n'être qu'une préférence | 11 | 0,39 $, 323 s | `api` reconnaît ses appelants par **cookie** (`session.ts:22`) | Juste. Les utilitaires JSON ne comptent plus ; la déstructuration (`const { cookies } = req`) est lue |

À chaque essai, Muse Spark a demandé l'arbre syntaxique de ses exemples avant d'écrire ses requêtes, puis a corrigé jusqu'à ce que `check_pack` accepte : un tiret hors guillemets dans une règle (essai 1), un faux ami qui sortait (essai 3).

## Vérifié

- **Le parcours entier** sur une copie d'atelier-api : le pack proposé ne touche pas la carte ; l'aperçu montre « api reconnaît ses appelants par cookie » ; accepté, il est chargé à chaud et la carte le montre ; retiré, la carte redevient identique à celle d'avant.
- **À l'aveugle sur OpenArchiver**, qu'il n'a jamais vu : une seule affirmation, juste. Le contrôleur MFA lit le jeton `mfaPending` en cookie (`mfa.controller.ts:169`). Le front SvelteKit, qui lit ses cookies par `event.cookies.get` sans cookie-parser, n'est pas compté.

## Ses limites

- Il reconnaît la requête par le nom de sa variable, `req` ou `request` : c'est une convention, pas l'API. Un gestionnaire qui nomme son paramètre autrement n'est pas lu.
- Il ne se rattache pas aux gardes (`entry_guard`), bien que la fiche les propose : un cookie de préférence lu par `req.cookies` serait compté comme une preuve d'identité. C'est à l'humain de le voir dans l'aperçu avant d'accepter.
