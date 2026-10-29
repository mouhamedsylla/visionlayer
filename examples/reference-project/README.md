# Projet de référence — Auth / Invitations

Petit projet TypeScript réaliste (pas une fixture minimale à un ou deux fichiers) utilisé pour les **tests globaux de bout en bout** de VisionLayer — voir `tests/e2e-reference-project.test.ts`.

Reprend volontairement le domaine utilisé comme exemple dans `docs/vision-layer-concept.md` (Authentication → Invitations → InvitationService/TokenService/EmailService), pour que le test global reste lisible et rattaché à la documentation conceptuelle plutôt qu'un domaine arbitraire.

Caractéristiques exploitées par le test global :

- Dossiers imbriqués (`src/auth/user`, `src/auth/token`, `src/auth/invitations`).
- Dépendances internes croisées (`invitations/service.ts` dépend de `token/service.ts`, `../../notifications/email.ts`, `./repository.ts`).
- Dépendance externe (`node:crypto`).
- Ré-exports avec alias (`generateToken`, `validateToken` dans `auth/index.ts`) et sans alias (`getUser`, `createUser`, `createInvitation`).
- Un `export * from` volontairement non suivi (`src/index.ts`) — limite connue et acceptée de l'extracteur (cf. `docs/decisions/0004-testing-strategy.md`).

Ce projet n'est pas destiné à être compilé ou exécuté — seulement scanné par VisionLayer.
