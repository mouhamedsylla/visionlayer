/**
 * Niveau Architecture (ADR 0012) : comment le système FONCTIONNE — ce qui
 * s'exécute (blocs), par où on y entre (points d'entrée), et qui parle à qui
 * (liens). Pas l'arborescence des fichiers : celle-ci est le niveau
 * « Structure du code ».
 *
 * Tout ce qui est ici est EXTRAIT du code ou de la configuration, avec la
 * ligne qui le prouve (`Evidence`). Ce que le code ne dit pas (où pointe une
 * URL lue dans une variable d'environnement, ce qu'est un backend hors du
 * repository) reste signalé comme tel, jamais deviné.
 */

export type BlockKind = "client" | "service" | "datastore" | "queue" | "capability" | "external";

/** Une ligne de code qui prouve un fait. `text` = la ligne, telle qu'écrite (tronquée à 200 caractères). */
export interface Evidence {
  path: string;
  line: number;
  text: string;
  /** Lien d'appel : le point d'entrée que cette ligne appelle (un lien regroupe les appels vers plusieurs fonctions). */
  target?: string;
}

export type EntryKind = "callable" | "http" | "trigger" | "schedule" | "task" | "server" | "app";

/** Point d'entrée d'un bloc : une Cloud Function, une route HTTP, un déclencheur, le main d'une app… */
export interface EntryPoint {
  id: string;
  block: string;
  name: string;
  kind: EntryKind;
  path: string;
  line: number;
  /** Symbole (id du modèle) qui porte la logique, si connu. */
  symbol?: string;
  /** Détail factuel : document déclencheur, route, région… */
  detail?: string;
  /** Fichiers que ce point d'entrée exécute (son fichier + ce que sa déclaration importe, transitivement). */
  files?: string[];
  /**
   * Lignes de son propre fichier qu'une fonction exécute : sa déclaration et
   * les fonctions locales qu'elle utilise. Les autres fichiers de `files`
   * comptent en entier.
   */
  ranges?: [number, number][];
}

/** Un accès (lecture/écriture/appel) situé dans le code, rattaché aux points d'entrée qui l'atteignent. */
export interface Access {
  block: string;
  op: string;
  path: string;
  line: number;
  text: string;
  /** Points d'entrée dont le code atteint cette ligne (par imports). */
  entries: string[];
}

export interface CollectionFact {
  /** Chemin normalisé : `users/{}/tutorSessions`. */
  path: string;
  rules?: Evidence;
  reads: Access[];
  writes: Access[];
  /** Points d'entrée déclenchés par une écriture dans cette collection. */
  triggers: string[];
}

export interface AiProviderFact {
  tech: string;
  name: string;
  evidence: Evidence[];
}

export type BlockInterior =
  | { kind: "datastore"; collections: CollectionFact[] }
  | { kind: "ai"; providers: AiProviderFact[]; models: { name: string; evidence: Evidence[] }[]; files: string[]; usedBy: string[]; dirs: string[] }
  | { kind: "queue"; targets: { label: string; evidence: Evidence }[] }
  | { kind: "external"; urls: Evidence[] };

export interface ArchBlock {
  id: string;
  name: string;
  kind: BlockKind;
  /** Technologie du catalogue (logo). */
  tech?: string;
  /** Sous-titre factuel court : « 18 fonctions », « Hosting prep », « hors du repository ». */
  subtitle: string;
  /** D'où vient le bloc (fichier de déploiement, ou premier usage dans le code). */
  origin: Evidence;
  /** Fichiers source qui constituent le bloc (clients, services). */
  files: string[];
  entries: string[];
  interior?: BlockInterior;
}

export type LinkKind = "calls" | "reads" | "writes" | "triggers" | "enqueues" | "uses" | "requests";

export interface ArchLink {
  id: string;
  from: string;
  to: string;
  kind: LinkKind;
  /** Nombre d'occurrences dans le code. */
  count: number;
  /** Sous-ensemble ordonné des preuves (les 60 premières). */
  evidence: Evidence[];
  /** Points d'entrée côté cible (fonctions appelées, déclencheurs). */
  targets: string[];
}

export interface ArchWarning {
  code: "unresolved_target" | "dynamic_path" | "unknown_callable" | "uncalled_entry";
  message: string;
  evidence?: Evidence;
}

export interface ArchModel {
  version: 1;
  blocks: ArchBlock[];
  entries: EntryPoint[];
  links: ArchLink[];
  warnings: ArchWarning[];
}

/* ------------------------------------------------------------------------ */
/* Version 2 : le modèle neutre (ADR 0017)                                   */
/* ------------------------------------------------------------------------ */

/**
 * Aucun nom de technologie dans la FORME de ce modèle : une technologie peut
 * être une valeur (`tech`, pour le logo), jamais un champ. Le schéma strict
 * (`schema.ts`) refuse tout champ inconnu.
 */

export type Level = "system" | "deployable" | "component" | "code";

export type NodeRole =
  // niveau système
  | "actor" | "external"
  // niveau déployable
  | "app" | "service" | "function" | "worker" | "job" | "store" | "channel" | "binary" | "managed"
  // niveau composant
  | "module" | "layer" | "adapter";

/** D'où vient un fait. `runtime` est prévu, pas encore lu (doc 07 §8). */
export type Source = "syntax" | "symbols" | "manifest" | "pack" | "runtime" | "declared";

/** `extracted` = lu ; `proposed` = calculé par une règle ; `declared` = écrit par un agent ou un humain. */
export type NodeStatus = "extracted" | "proposed" | "declared";

/** Une ligne qui prouve un fait, et la source qui l'a produit. */
export interface Proof {
  path: string;
  line: number;
  /** La ligne telle qu'écrite (tronquée à 200 caractères, secrets masqués). */
  text?: string;
  source: Source;
  /** Le pack qui a produit le fait, quand `source` vaut `pack`. */
  pack?: string;
}

/** Référence au niveau code : un symbole de `.vision/model.json`. */
export interface SymbolRef {
  path: string;
  line: number;
  name: string;
}

export type EntrypointKind = "http" | "rpc" | "event" | "schedule" | "message" | "main" | "cli";

/** Garde d'accès d'un point d'entrée, telle que le code l'écrit. */
export interface Guard {
  /** `public` = aucune garde trouvée ; `unknown` = garde non reconnue. */
  level: "public" | "authenticated" | "role" | "signature" | "internal" | "unknown";
  roles?: string[];
  proof?: Proof;
  /** La fonction du dépôt qui tient la garde : celle que la route, ou un intermédiaire posé avant elle, appelle. */
  by?: SymbolRef;
}

export interface Entrypoint {
  id: string;
  kind: EntrypointKind;
  /** `POST /bookings`, `placeOrder`, `*\/5 * * * *`, `emails`, `src/server.ts`. */
  key: string;
  handler?: SymbolRef;
  proof: Proof;
  access?: Guard;
  /** Ce qui l'appelle ou le déclenche : ids de nœuds ou de points d'entrée. */
  calledBy?: string[];
  /**
   * Fichiers que ce point d'entrée exécute, lus au niveau des fonctions : celui
   * de sa fonction, ceux des fonctions du dépôt qu'elle appelle de proche en
   * proche, et ceux dont elle emploie une valeur de premier niveau (`db.select()`).
   * Un fichier seulement importé n'en fait pas partie. Sans fonction connue :
   * son fichier et ce qu'il importe.
   */
  files?: string[];
  /** Lignes de son propre fichier qu'il exécute : sa fonction et les fonctions du fichier qu'elle appelle. */
  ranges?: [number, number][];
  /** Ce que fait son code, dans l'ordre des lignes, fonctions du dépôt dépliées. */
  flow?: FlowStep[];
}

/**
 * Une étape du déroulé d'un point d'entrée, extraite du code, jamais résumée :
 * `read` à `write` reprennent un lien de la carte (la cible est son bloc),
 * `invoke` est l'appel d'une fonction du dépôt dont les étapes suivent un
 * cran plus profond, `refuse` un `throw`, `return` un retour anticipé,
 * `reply` ce que la route répond.
 */
export interface FlowStep {
  kind: EdgeKind | "invoke" | "refuse" | "return" | "reply";
  /** 0 pour le code du point d'entrée, 1 pour une fonction qu'il appelle, etc. */
  depth: number;
  proof: Proof;
  /** Pour un lien : le bloc visé, et la table ou la file. */
  target?: { node: string; entity?: string; topic?: string };
  /** La fonction appelée (`invoke`), ou la méthode employée (`paymentIntents.create`, `json`). */
  name?: string;
  /** Un refus ou une réponse : son code (`409`) et son texte (`not_pending`). */
  status?: string;
  code?: string;
  /** La condition écrite devant un refus ou un retour : `booking.status !== "pending"`. */
  when?: string;
  /** Le refus est dans un `catch` : il arrive quand l'appel juste avant échoue. */
  onError?: boolean;
  /** Le commentaire de l'auteur juste au-dessus de l'instruction. */
  why?: { text: string; proof: Proof };
  /** L'étape est dans une transaction : ses bornes, pour dessiner le cadre de cohérence. */
  tx?: { path: string; from: number; to: number };
}

export interface Field {
  name: string;
  type?: string;
  nullable?: boolean;
  /** Valeurs permises quand le code les énumère. */
  values?: string[];
  /** Valeur par défaut posée par la base, quand elle est littérale. */
  default?: string;
  /** Ce que l'auteur dit du champ, en commentaire là où il le déclare. */
  comment?: string;
  /** Les lignes du code qui écrivent ce champ. */
  writes?: FieldWrite[];
  /** Les lignes du code qui lisent ce champ : nommé dans la lecture, ou rendu avec toute la ligne (`whole`). */
  reads?: FieldRead[];
  proof?: Proof;
}

/** Une lecture d'un champ : `phone` rendu par `exportUsers`. */
export type FieldRead = Omit<FieldWrite, "value"> & { whole?: boolean };

/** Une écriture d'un champ : `status: "cancelled"` dans `expireHolds`. */
export interface FieldWrite {
  /** La valeur écrite quand elle est littérale ; absente quand le code la calcule. */
  value?: string;
  /** La fonction de premier niveau qui contient l'écriture. */
  fn?: string;
  /** Le déployable dont le code contient la ligne. */
  node?: string;
  /** Points d'entrée dont le code atteint cette ligne. */
  entrypoints?: string[];
  proof: Proof;
}

export interface Constraint {
  kind: "primary" | "unique" | "foreign" | "check" | "index";
  name?: string;
  fields: string[];
  /** Condition telle qu'écrite : partielle pour un index (`status <> 'cancelled'`), la règle elle-même pour un check. */
  where?: string;
  /** L'entité visée par une clé étrangère. */
  references?: string;
  /** Ce que fait la base quand la ligne visée est supprimée : Cascade, Restrict, SetNull… */
  onDelete?: string;
  /** Ce que l'auteur en dit, en commentaire au-dessus de la contrainte. */
  comment?: string;
  proof: Proof;
}

export interface Entity {
  /** `bookings`, `users/{}/tutorSessions`. */
  name: string;
  /** La section du fichier où elle est déclarée, d'après un commentaire de séparation (`// ── Paiements ──`). */
  group?: string;
  /** Ce que l'auteur dit de l'entité, en commentaire au-dessus de sa déclaration. */
  comment?: string;
  fields?: Field[];
  constraints?: Constraint[];
  /** Règle d'accès écrite près des données (règles de sécurité, politiques de ligne). */
  rule?: Proof;
  /** Code qui s'exécute quand l'entité change, dans le stockage ou ailleurs. */
  triggers?: { name: string; on: ("insert" | "update" | "delete" | "write")[]; proof: Proof; writes?: string[] }[];
  proof?: Proof;
}

export interface DataFacet {
  shape: "relational" | "document" | "key-value" | "blob" | "search" | "graph" | "unknown";
  entities: Entity[];
}

/** Un type du contrat (ce qu'une opération reçoit ou rend), champ par champ, avec le commentaire de l'auteur. */
export interface Shape {
  name: string;
  proof: Proof;
  fields: { name: string; type?: string; optional?: boolean; comment?: string; line: number }[];
}

export interface ContractFacet {
  name: string;
  interface: SymbolRef;
  /** Le commentaire qui ouvre le fichier d'entrée du module : la règle que l'auteur y écrit. */
  summary?: { text: string; proof: Proof };
  operations: { name: string; line: number; comment?: string; request?: Shape; result?: Shape }[];
  implementations: {
    name: string;
    path: string;
    line: number;
    /** Ce que l'opération appelle hors de la classe : le client du fournisseur (`this.client.emails.send`). */
    calls?: { name: string; proof: Proof }[];
    /** Les retours de l'opération : là où la réponse native redevient le résultat du contrat. */
    returns?: Proof[];
    /** Les paquets externes que son fichier importe. */
    packages?: string[];
  }[];
  /** Là où un conteneur d'injection branche chaque implémentation sur le contrat (`{ provide: X, useClass: Y }`). */
  bindings?: { implementation: string; proof: Proof }[];
  /** Les classes qui reçoivent le contrat du conteneur, sans le construire. */
  consumers?: { name: string; proof: Proof }[];
  /** Ce qui choisit l'implémentation : une fabrique, la configuration qu'elle lit, et quelle valeur mène à quelle classe (sans valeur : le cas par défaut). */
  selector?: { symbol: SymbolRef; config?: string[]; choices?: { when?: string; implementation: string; proof: Proof }[] };
  /** Les paquets des implémentations, et chaque import de l'un d'eux hors du module. */
  sealed?: { packages: string[]; leaks: Proof[] };
}

export interface Setting {
  key: string;
  value: string;
  proof: Proof;
}

export interface ChannelFacet {
  shape: "queue" | "topic" | "stream" | "task" | "event";
  topics: { name: string; proof: Proof; settings?: Setting[] }[];
}

export interface ConfigFacet {
  /** Noms seulement : la valeur n'est jamais lue. */
  env: { name: string; readAt: Proof[]; required?: boolean }[];
  environments?: string[];
  /**
   * Une validation de l'environnement qui s'exécute au chargement du module : tout fichier qui le charge,
   * directement ou par ses imports (`loadedBy`), échoue à l'import quand une variable exigée manque, en test comme ailleurs.
   */
  loadChecks?: { proof: Proof; required: string[]; loadedBy: string[] }[];
}

export interface TrustFacet {
  /** Comment un appelant prouve qui il est : `session`, `token`, `signature`, `api-key`… */
  mechanisms: { name: string; proof: Proof }[];
  /** Exposé hors du système, ou interne seulement. */
  exposure?: "public" | "internal";
}

export interface Facets {
  entrypoints?: Entrypoint[];
  data?: DataFacet;
  contract?: ContractFacet[];
  channel?: ChannelFacet;
  config?: ConfigFacet;
  trust?: TrustFacet;
  /** Les fonctions du dépôt qui font quelque chose de visible ou que d'autres appellent (écran Code). */
  functions?: CodeFunction[];
  /** Ce qu'un composant sert dans son déployable, calculé depuis la portée des points d'entrée. */
  component?: ComponentFacet;
}

/**
 * Un composant vu depuis ce qui s'exécute (vision/facts/components.ts). Tout
 * y est calculé : le nœud porte `status: "proposed"`, sauf un composant à
 * contrat, lu dans le code, qui reçoit cette facette en plus.
 */
export interface ComponentFacet {
  /** Comment ses fichiers ont été réunis : `folder` = le dossier où l'équipe les a rangés ; `contract` = le module d'un contrat ; `calls` = l'ancien regroupement par appels. */
  grouping: "folder" | "calls" | "contract";
  /**
   * Sa place dans le déployable, relative à ses points d'entrée : `base` s'il
   * en sert au moins les trois quarts ; `own` si tous ceux qu'il sert ont leur
   * fonction dans un même composant ; `shared` sinon.
   */
  reach: "own" | "shared" | "base";
  /** Les points d'entrée du déployable dont la portée exécute ses fichiers (ids). */
  entrypoints: string[];
  /** Le nombre de fonctions de premier niveau dans ses fichiers exécutés. */
  functions: number;
  /** Ce que ses fichiers lisent, écrivent, publient, appellent : les occurrences des liens du déployable écrites chez lui, par cible. */
  touches: { kind: EdgeKind; node: string; entity?: string; topic?: string; count: number; proof: Proof[] }[];
  /** La couche de chacun de ses fichiers, lue dans les faits (components.ts). */
  layers?: Record<string, ComponentLayer>;
}

/** `entry` : porte un point d'entrée ; `data` : lit ou écrit un stockage ; `external` : appelle un service extérieur ou publie ; `logic` : le reste. */
export type ComponentLayer = "entry" | "logic" | "data" | "external";

/**
 * Une fonction du dépôt, ouverte seule : sa déclaration, ce que fait son code
 * (le même déroulé qu'un point d'entrée), les lignes qui l'appellent et ce
 * qu'elle appelle. Rien n'est résumé : chaque fait renvoie à sa ligne.
 */
export interface CodeFunction {
  /** `src/payments/refund.ts:12` : son fichier et sa première ligne. */
  id: string;
  name: string;
  proof: Proof;
  /** Sa dernière ligne. */
  end: number;
  exported?: boolean;
  flow?: FlowStep[];
  /** Chaque ligne qui l'appelle, avec la fonction qui la contient quand elle en a une. */
  calledFrom?: { proof: Proof; fn?: string }[];
  /** Ce qu'elle appelle par son nom, dans l'ordre : `local` quand la fonction est dans le dépôt, `to` la fonction appelée (son `id`). */
  calls?: { name: string; local: boolean; proof: Proof; to?: string }[];
}

export interface ArchNode {
  id: string;
  name: string;
  level: Level;
  role: NodeRole;
  /** Le nœud qui le contient (un composant dans son déployable). */
  parent?: string;
  /** Technologies du catalogue (logo) : des valeurs, jamais des champs. */
  tech?: string[];
  /** Sous-titre factuel court. */
  subtitle?: string;
  /** Ce que fait le bloc, en une phrase calculée depuis ses faits (context.ts) : « expose 15 routes, dont 8 gardées ; … ». */
  summary?: string;
  status: NodeStatus;
  /** D'où vient le nœud (fichier de déploiement, ou premier usage dans le code). */
  proof: Proof[];
  /** Fichiers source qui le constituent. */
  files?: string[];
  /** Combien d'exemplaires tournent. */
  instances?: { min: number; max?: number; proof: Proof };
  /** Faits littéraux du code : modèle cité, région… */
  attributes?: Setting[];
  facets: Facets;
}

export type EdgeKind = "call" | "read" | "write" | "message" | "request" | "trigger" | "use" | "deploy";

export interface Occurrence extends Proof {
  /** Points d'entrée dont le code atteint cette ligne. */
  entrypoints?: string[];
}

export interface ArchEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  /** Cible plus fine dans `to`. */
  target?: { entity?: string; entrypoint?: string; topic?: string };
  count: number;
  /** Sous-ensemble ordonné des preuves. */
  occurrences: Occurrence[];
}

export type FindingCode =
  | "uncalled_entry" | "unknown_callable" | "unresolved_target" | "dynamic_path"
  | "unguarded_route" | "race_read_then_write" | "write_then_enqueue" | "order_assumption"
  | "personal_data_logged" | "scheduled_on_every_instance" | "doc_contradiction"
  | "unused_value" | "dead_code" | "missing_timeout" | "read_outside_tx";

export interface Finding {
  code: FindingCode;
  message: string;
  proof: Proof[];
  nodes?: string[];
  source: Source;
}

export type GapKind = "language_not_read" | "pack_missing" | "pack_failed" | "target_unknown" | "path_dynamic" | "manifest_unknown";

export interface Coverage {
  level: Level;
  unit: "files" | "manifests" | "deployables" | "calls";
  /** Analysés : le lecteur de syntaxe les a ouverts. */
  read: number;
  total: number;
  /**
   * Compris (fichiers seulement) : exécutés par un programme dont le lancement est lu. Un fichier analysé mais
   * rattaché à aucun programme (un test, une configuration, le code d'une app dont le framework n'a pas de pack)
   * n'est pas compris : la carte ne dit rien de ce qu'il fait.
   */
  understood?: number;
  /** `proof` : le premier endroit ; `where` : tous, pour dire de chaque élément manquant s'il est non lu. */
  gaps: { kind: GapKind; subject: string; count: number; proof?: Proof; where?: Proof[] }[];
}

export interface ArchModelV2 {
  version: 2;
  system: { name: string };
  nodes: ArchNode[];
  edges: ArchEdge[];
  findings: Finding[];
  coverage: Coverage[];
}
