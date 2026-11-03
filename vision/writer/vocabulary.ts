import { relationArities, type Pack } from "../facts/packs.js";

/**
 * Le vocabulaire de faits qu'un pack écrit par un agent peut employer (ADR 0019 §1). Sans lui, un modèle
 * décrit des appels de fonctions, et pas ce que la carte sait montrer (essai du 29/10 sur cookie-parser).
 *
 * Deux listes : ce qu'un pack peut lire (la syntaxe, lue sans aucun pack, et les relations du cœur), et ce
 * qu'il peut produire pour que la carte change (les relations neutres que lit l'assembleur). L'arité vient
 * des packs livrés quand ils en produisent ; le sens, de vision/facts/syntax.ts et de vision/facts/assemble.ts.
 */
export interface Relation { name: string; args: string[]; meaning: string; example?: string }

export const READABLE: Relation[] = [
  { name: "import_raw", args: ["Fichier", "Local", "Spécificateur", "Importé"], meaning: "un import tel qu'écrit", example: 'import cron from "node-cron" → import_raw("jobs.ts", "cron", "node-cron", "default")' },
  { name: "imports", args: ["Fichier", "Local", "FichierCible", "Importé"], meaning: "un import résolu vers un fichier du dépôt" },
  { name: "defines", args: ["Fichier", "Nom", "Ligne"], meaning: "function f, const f = …, class C" },
  { name: "export_fn", args: ["Fichier", "Nom", "Ligne"], meaning: "une fonction exportée" },
  { name: "fn_span", args: ["Fichier", "Nom", "Début", "Fin"], meaning: "les lignes d'une fonction de premier niveau" },
  { name: "member_call", args: ["Fichier", "Racine", "Chemin", "Ligne"], meaning: "un appel sur une valeur", example: 'stripe.paymentIntents.create(…) → member_call(F, "stripe", "paymentIntents.create", L)' },
  { name: "env", args: ["Fichier", "Nom"], meaning: "une variable d'environnement lue (process.env.NOM)" },
  { name: "entrypoint", args: ["Fichier", "Genre", "Clé", "Fonction", "Ligne"], meaning: "un point d'entrée déjà lu par un autre pack (une route Express…)" },
  { name: "entry_guard", args: ["Fichier", "Ligne", "Niveau", "FichierGarde", "LigneGarde"], meaning: "la garde du point d'entrée déclaré à Fichier:Ligne : la fonction du dépôt qui refuse l'appelant, écrite à FichierGarde:LigneGarde ; Niveau vaut auth (elle répond 401 : l'appelant n'est pas reconnu) ou role (403). La lire demande requires: [entry_guard]" },
  { name: "handler_at", args: ["Fichier", "Clé", "FichierCode", "LigneCode"], meaning: "où est écrit le code d'un point d'entrée" },
  { name: "present", args: ["Fichier"], meaning: "un fichier du dépôt, quel que soit son langage : la seule façon de voir un fichier qu'aucun import ne nomme (une page, une route par fichier)" },
  { name: "pkg_name", args: ["Manifeste", "Nom"], meaning: "le nom d'un paquet, d'après son package.json", example: 'packages/web/package.json, "@acme/web"' },
  { name: "pkg_value", args: ["Fichier", "Nom", "Paquet"], meaning: "dans ce fichier, ce nom désigne une valeur construite par ce paquet : créée ici (`const db = new Client()`, même `globalThis.db ?? new Client()`), ou importée d'un module du dépôt qui la crée (`import { prisma } from '@/lib/prisma'`). C'est la forme la plus courante d'un client partagé ; joins-la à member_call pour lire ses appels", example: 'pkg_value("src/app/api/orders/route.ts", "prisma", "@prisma/client")' },
  { name: "reach", args: ["FichierLancé", "Fichier"], meaning: "les fichiers qu'un programme lancé atteint par ses imports" },
];

export const PRODUCIBLE: Relation[] = [
  { name: "unit", args: ["Fichier", "Nom", "Genre"], meaning: "un programme que le dépôt fait tourner, déclaré par ce fichier. Genre : service, function, process, page", example: 'unit("package.json", "shop", "service")' },
  { name: "unit_runs", args: ["Fichier", "Nom", "FichierLancé"], meaning: "le fichier de code par lequel ce programme démarre ; son code est tout ce que ce fichier atteint" },
  { name: "unit_tech", args: ["Fichier", "Nom", "Tech"], meaning: "la technologie qui fait tourner ce programme (identifiant du catalogue : nextjs, sveltekit…)" },
  { name: "loads", args: ["Fichier", "FichierChargé"], meaning: "quand Fichier tourne, le framework charge aussi FichierChargé par convention, sans import : une page, une route écrite dans un fichier. Ses imports suivent" },
  { name: "entrypoint", args: ["Fichier", "Genre", "Clé", "Fonction", "Ligne"], meaning: "une porte d'entrée dans le programme. Genre : http, rpc, event, message, schedule, cli. La carte la montre dans son bloc, et suit ce que son code exécute", example: 'entrypoint("jobs.ts", "schedule", "0 8 * * *", "sendDigest", 3)' },
  { name: "trust", args: ["Fichier", "Mécanisme", "Ligne"], meaning: "là où le code lit la preuve qu'un appelant présente pour être reconnu : le cookie qu'il lit pour retrouver l'appelant, le jeton qu'il vérifie. Un outil monté ou configuré ne suffit pas : sans lecture de la preuve, aucun fait. Une valeur lue ailleurs que dans une garde peut n'être qu'une préférence (un thème, une langue) : la preuve d'identité est celle que lit une garde (entry_guard), la fonction qui refuse l'appelant quand elle manque. Mécanisme : cookie (un cookie lu tel qu'il arrive), signed-cookie (un cookie dont la signature est vérifiée à la lecture), token, signature, api-key. La carte le montre sur le bloc qui atteint ce fichier", example: 'trust("auth.ts", "token", 12)' },
  { name: "accesses", args: ["Fichier", "Op", "Tech", "Entité", "Ligne"], meaning: "une lecture (read) ou une écriture (write) d'une entité d'un stockage", example: 'accesses("repo.ts", "write", "postgresql", "users", 12)' },
  { name: "entity_seen", args: ["Tech", "Forme", "Entité", "Fichier"], meaning: "une entité vue à l'usage (relational, document, key-value)" },
  { name: "uses_store", args: ["Fichier", "Tech"], meaning: "le code ouvre une connexion à ce stockage, à cette ligne" },
  { name: "publishes", args: ["Fichier", "Topic"], meaning: "le code publie un message sur ce topic ou cette file" },
  { name: "subscribes", args: ["Fichier", "Topic"], meaning: "le code consomme ce topic ou cette file" },
  { name: "external_pkg", args: ["Paquet", "Tech", "Nom"], meaning: "ce paquet est le client d'un service externe" },
  { name: "client", args: ["Fichier", "Paquet"], meaning: "un client de service externe est construit dans ce fichier" },
  { name: "calls_external", args: ["Fichier", "Paquet", "Ligne"], meaning: "un appel au service externe" },
  { name: "inbound_from", args: ["Fichier", "Paquet", "Ligne"], meaning: "le code vérifie la signature d'un appel entrant de ce service" },
  { name: "env_read", args: ["Fichier", "Nom", "Ligne"], meaning: "une variable de configuration lue à cette ligne" },
  { name: "env_required", args: ["Fichier", "Nom", "yes|no"], meaning: "la variable est obligatoire ou non, d'après le code" },
  { name: "binds", args: ["Fichier", "Contrat", "Implémentation", "Ligne"], meaning: "un conteneur d'injection donne cette classe à qui demande ce contrat ; Fichier est là où le lien est écrit. Le contrat est une interface ou une classe abstraite du dépôt. La carte dessine le contrat (X3) avec ses implémentations et l'endroit où chacune est branchée", example: 'binds("users/users.module.ts", "UserRepository", "UsersRelationalRepository", 12)' },
  { name: "receives", args: ["Fichier", "Classe", "Contrat", "Ligne"], meaning: "cette classe reçoit ce contrat du conteneur, sans le construire elle-même (par son constructeur, le plus souvent) ; la carte la montre parmi ceux qui emploient le contrat", example: 'receives("users/users.service.ts", "UsersService", "UserRepository", 25)' },
  { name: "unresolved", args: ["Fichier", "Genre", "Ligne"], meaning: "reconnu sans pouvoir le relier : un trou de couverture (path_dynamic, target_unknown)" },
];

/** Le vocabulaire écrit pour la fiche, avec l'arité réelle des packs livrés quand elle existe. */
export function vocabularyText(builtins: Pack[]): string {
  const arity = new Map<string, number>();
  for (const p of builtins) for (const [r, n] of relationArities(p)) arity.set(r, n);
  const line = (r: Relation) => {
    const n = arity.get(r.name);
    if (n !== undefined && n !== r.args.length) throw new Error(`vocabulaire : ${r.name} a ${r.args.length} arguments ici, ${n} dans les packs livrés`);
    return `- \`${r.name}(${r.args.join(", ")})\` : ${r.meaning}.${r.example ? ` Exemple : \`${r.example}\`.` : ""}`;
  };
  return [
    "### Ce qu'un pack peut lire",
    "",
    "Les faits de la syntaxe, lus sans aucun pack, et ceux du cœur. Une règle peut les joindre.",
    "",
    ...READABLE.map(line),
    "",
    "### Les fonctions du langage",
    "",
    "- `P = cat(A, \"/\", B)` : colle des valeurs liées en une chaîne.",
    "- `glob(F, Motif, C)` : F, lié par un fait écrit avant, suit le motif (`*` dans un segment, `**` sur plusieurs) ; C reçoit ce qu'ont pris les jokers. Pour un framework qui route par ses fichiers. Exemple : `present(F), glob(F, \"src/app/**/route.ts\", C)` donne `C = \"api/orders/[id]\"` pour `src/app/api/orders/[id]/route.ts`.",
    "- `route_path(C, P)` : un chemin de dossiers devient la route qu'il sert, selon les conventions de routage par fichiers : `(groupe)` disparaît, `[id]` devient `:id`, `[...x]` devient `*`, `index` disparaît. Exemple : `route_path(\"(shop)/orders/[id]\", P)` donne `P = \"/orders/:id\"`.",
    "",
    "### Ce qu'un pack peut produire pour que la carte change",
    "",
    "Les relations neutres que lit l'assembleur de la carte. Un pack peut aussi produire des relations internes, préfixées par son identifiant (`node_schedule_job` pour `node-schedule`), que ses règles joignent ensuite ; elles n'apparaissent pas sur la carte.",
    "",
    ...PRODUCIBLE.map(line),
  ].join("\n");
}
