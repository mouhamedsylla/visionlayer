# Pack Better Auth

Better Auth gère les comptes, les sessions et les connexions. Il écrit lui-même ses tables (`user`, `session`, `account`, `verification`) par un adaptateur (Prisma, Drizzle, Kysely…), derrière un seul gestionnaire monté sur une route (`/api/auth/*`). Le code du projet ne les écrit pas : sans ce pack, ces tables sont dites « ni lues ni écrites », et `user.email` n'a aucun écrivain.

Ce pack rend ces écritures à la ligne où le gestionnaire est monté, et les lectures à chaque `getSession`. Il ne déclare aucune table : il complète celles que déclare le schéma du projet (Prisma, Drizzle), et seulement les champs que ce schéma déclare.

| Forme | Exemple | Ce qui est produit |
|---|---|---|
| B1 l'instance | `export const auth = betterAuth({ … })` | l'instance, suivie partout où elle est importée |
| B2 le gestionnaire monté | `export const { GET, POST } = toNextJsHandler(auth)` ; `toNodeHandler(auth)` ; `app.all("/api/auth/*", auth.handler)` | à sa ligne, une écriture de chaque champ des tables de base (`user` : `name`, `email`, `emailVerified`, `image` ; `session` : `token`, `userId`, `expiresAt`, `ipAddress`, `userAgent` ; `account` : `providerId`, `password`, les jetons… ; `verification` : `identifier`, `value`, `expiresAt`), sans valeur ; et une suppression de lignes de `session` et `verification` |
| B3 un champ ajouté | `user: { additionalFields: { phone: { type: "string", defaultValue: "x" } } }` | une écriture de `phone`, avec sa valeur par défaut quand elle est littérale |
| B4 un nom changé | `user: { modelName: "users", fields: { email: "email_address" } }` | les écritures vont à `users.email_address` |
| B5 le plugin admin | `plugins: [admin({ defaultRole: "CUSTOMER" })]` | une écriture de `user.role` (valeur `CUSTOMER`, `user` par défaut), `banned`, `banReason`, `banExpires`, `session.impersonatedBy` ; une suppression de lignes de `user` |
| B6 la session lue | `await auth.api.getSession({ headers })` | une lecture de la ligne entière de `session` et de `user`, à sa ligne |

Un champ est cherché sous son nom (`emailVerified`) et sous sa forme en base (`email_verified`), pour un schéma Drizzle écrit en snake_case.

Non lus : le client (`createAuthClient`, `authClient.signIn…`), les crochets (`databaseHooks`), les autres plugins (`organization`, `twoFactor`…), et les appels serveur autres que `getSession` (`auth.api.signUpEmail(…)`). `getSession` est aussi une garde (pas de session, pas d'accès) : l'écran Accès ne la lit pas encore comme telle.
