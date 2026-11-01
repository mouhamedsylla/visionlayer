import { attributeEntrypoints, attributeFieldWrites } from "./entry-reach.js";
import { attributeFlows } from "./flow.js";
import { attributeFunctions } from "./functions.js";
import { fnGraph } from "./fn-graph.js";
import { attributeComponents } from "./components.js";
import { entityDetails } from "./entity-detail.js";
import { addUnread, shortName } from "./unread.js";
import { methodResolver } from "./methods.js";
import { contractDetails } from "./contract-detail.js";
import type {
  ArchEdge, ArchModelV2, ArchNode, Coverage, EdgeKind, Entrypoint, EntrypointKind, Finding, Occurrence, Proof,
} from "../arch/types.js";
import { techsForPackage } from "../stack/catalog.js";
import type { Database, Value } from "./datalog.js";
import type { Pack } from "./packs.js";

/**
 * Du résultat des règles au modèle neutre v2 (ADR 0017). Aucun nom de pile
 * ici : l'assembleur ne lit que des relations neutres, que les packs
 * produisent.
 *
 *   unit / unit_runs / unit_instances / unit_image   ce qui se déploie (manifestes)
 *   unit_attr                                  un fait littéral du manifeste sur l'unité : sa région…
 *   reach(Lancé, Fichier)                             le code d'un déployable
 *   entry_in, entrypoint, handler_at                  ses points d'entrée et leur code
 *   accesses(Fichier, read|write, Tech, Entité, L)    lectures et écritures d'une entité
 *   entity_def(Tech, Forme, Entité, Fichier)          les entités déclarées
 *   image_store, uses_store                           les stockages, par image ou par pilote
 *   store_decl(Fichier, Tech, Rôle, Forme, Nom)       un stockage géré, déclaré par un manifeste
 *   finding(Code, Sujet, Détail, Fichier, Ligne)      un constat établi par les règles d'un pack ; finding_store(Code, Sujet, Tech) son stockage ;
 *   finding_proof(Code, Sujet, Détail, Fichier, Ligne, PFichier, PLigne)   les lignes qui le fondent, à la place de ses preuves de contexte
 *   entity_seen(Tech, Forme, Entité, Fichier)         une entité vue seulement à l'usage (requête SQL, collection)
 *   trigger_on(Fichier, Clé, Tech, Cible)             un stockage ou un canal qui déclenche un point d'entrée
 *   entity_rule(Fichier, Tech, Entité, Ligne)         la règle d'accès d'une entité (firestore.rules…)
 *   entity_field, entity_constraint, entity_trigger…  le détail d'une entité (entity-detail.ts)
 *   unresolved(Fichier, Genre, Ligne)                 ce qu'un pack a reconnu sans pouvoir le relier : un trou de couverture
 *   channel_topic, publishes, subscribes              les canaux de messages
 *   external_pkg, client, calls_external              les services externes
 *   env(Fichier, Nom)                                 les variables, par leur nom
 *   trust(Fichier, Mécanisme, Ligne)                  comment un appelant prouve qui il est, lu à cette ligne : cookie, signed-cookie, token…
 */

/** Catégories du catalogue qui disent l'architecture (pas les outils de test ni de style). */
const TECH_CATEGORIES = new Set(["framework", "backend", "database", "ai", "cloud"]);
const UNIT_PRIORITY = ["service", "function", "process", "page", "image"];
const KIND_ORDER: EntrypointKind[] = ["main", "http", "rpc", "event", "message", "schedule", "cli"];
/** Extensions de code qu'aucun lecteur n'ouvre encore : un trou « langage non lu », jamais un « rien ». */
const UNREAD_CODE = /\.(py|go|rb|java|kt|rs|php|cs|swift|c|cc|cpp|h|hpp|scala|ex|exs|dart|svelte|vue|astro)$/;

export interface AssembleOptions {
  name: string;
  packs: Pack[];
}

export function assemble(db: Database, opts: AssembleOptions): ArchModelV2 {
  const rows = (rel: string) => db.get(rel);
  const s = (v: Value | undefined) => String(v);
  const first = (p: Proof[]) => p[0];

  const read = new Set(rows("file").map((t) => s(t.args[0])));
  const present = new Set(rows("present").map((t) => s(t.args[0])));

  /* --- Déployables : un par fichier lancé ----------------------------------- */
  const units = new Map<string, { name: string; kind: string; proof: Proof[] }[]>();
  const unitKind = new Map(rows("unit").map((t) => [`${s(t.args[0])}\0${s(t.args[1])}`, { kind: s(t.args[2]), proof: t.proof }]));
  for (const t of rows("unit_runs")) {
    const [file, name, target] = t.args.map(s) as [string, string, string];
    if (!present.has(target)) continue;
    const u = unitKind.get(`${file}\0${name}`);
    const list = units.get(target) ?? units.set(target, []).get(target)!;
    list.push({ name, kind: u?.kind ?? "image", proof: [...t.proof.slice(0, 1), ...(u ? u.proof.slice(0, 1) : [])] });
  }

  const reachOf = new Map<string, string[]>();
  for (const t of rows("reach")) {
    const [r, f] = [s(t.args[0]), s(t.args[1])];
    (reachOf.get(r) ?? reachOf.set(r, []).get(r)!).push(f);
  }
  const deployableOf = (file: string) => [...reachOf].filter(([, files]) => files.includes(file)).map(([r]) => r);

  const entryFacts = new Map(rows("entrypoint").map((t) => [`${s(t.args[0])}\0${s(t.args[2])}`, t]));
  const handlers = new Map(rows("handler_at").map((t) => [`${s(t.args[0])}\0${s(t.args[1])}`, { path: s(t.args[2]), line: Number(t.args[3]) }]));
  // Un gestionnaire qui est la méthode d'une classe (`ctrl.find`, le contrôleur passé à la route) : la méthode elle-même (methods.ts).
  const methodOf = methodResolver(rows);
  for (const t of rows("entrypoint")) {
    const [file, , key, name] = t.args.map(s) as [string, string, string, string];
    if (handlers.has(`${file}\0${key}`) || !name.includes(".")) continue;
    const m = methodOf(file, Number(t.args[4]), name.slice(0, name.indexOf(".")), name.slice(name.indexOf(".") + 1));
    if (m) handlers.set(`${file}\0${key}`, { path: m.path, line: m.start });
  }

  const at = (path: string, line: number, proof: Proof[]): Occurrence => proof.find((p) => p.path === path && p.line === line) ?? { path, line, source: "syntax" };

  const nodes: ArchNode[] = [];
  const nodeIdOf = new Map<string, string>();
  const usedIds = new Set<string>();
  const coverageGaps: Coverage["gaps"] = [];
  /** Les programmes nommés d'après un Dockerfile seul : son dossier (`docker`) ne dit pas ce qui tourne. */
  const fromImage = new Set<string>();

  for (const [target, list] of [...units].sort(([a], [b]) => a.localeCompare(b))) {
    const best = [...list].sort((a, b) => UNIT_PRIORITY.indexOf(a.kind) - UNIT_PRIORITY.indexOf(b.kind))[0]!;
    let id = best.name;
    if (usedIds.has(id)) id = `${best.name}:${target}`;
    usedIds.add(id);
    nodeIdOf.set(target, id);
    const files = (reachOf.get(target) ?? []).filter((f) => read.has(f)).sort();

    const entrypoints: Entrypoint[] = rows("entry_in")
      .filter((t) => s(t.args[0]) === target)
      .map((t) => {
        const [, file, kind, key] = t.args.map(s) as [string, string, EntrypointKind, string];
        const fact = entryFacts.get(`${file}\0${key}`)!;
        const name = s(fact.args[3]);
        const h = handlers.get(`${file}\0${key}`) ?? { path: file, line: Number(fact.args[4]) };
        return {
          id: `${id}:${kind}:${key}`,
          kind,
          key,
          handler: { path: h.path, line: h.line, name: name || "fonction anonyme" },
          proof: first(fact.proof)!,
        };
      })
      .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.proof.path.localeCompare(b.proof.path) || a.proof.line - b.proof.line);
    // Le démarrage lui-même : le fichier lancé, ou la page qui charge l'app.
    const page = list.find((u) => u.kind === "page");
    const mainKey = page ? page.proof[0]!.path : target;
    entrypoints.unshift({ id: `${id}:main:${mainKey}`, kind: "main", key: mainKey, proof: (page ?? best).proof[0]! });

    const role: ArchNode["role"] = best.kind === "page" ? "app"
      : best.kind === "function" ? "function"
      : entrypoints.some((e) => e.kind === "http" || e.kind === "rpc") ? "service"
      : entrypoints.some((e) => e.kind !== "main") && entrypoints.every((e) => e.kind === "main" || e.kind === "message" || e.kind === "schedule") ? "worker"
      : "service";

    // Technologies : celles des paquets que son code importe vraiment.
    const tech = new Set<string>();
    // Et celles que le manifeste dit (une page dans la racine d'une configuration de Vite).
    for (const t of rows("unit_tech")) if (list.some((u) => u.name === s(t.args[1]) && u.proof.some((p) => p.path === s(t.args[0])))) tech.add(s(t.args[2]));
    for (const t of rows("imports_pkg")) {
      if (!files.includes(s(t.args[0]))) continue;
      for (const entry of techsForPackage("npm", s(t.args[2]))) if (TECH_CATEGORIES.has(entry.category)) tech.add(entry.id);
    }

    const env = new Map<string, Proof[]>();
    for (const t of rows("env")) if (files.includes(s(t.args[0]))) {
      const n = s(t.args[1]);
      env.set(n, [...(env.get(n) ?? []), ...t.proof.slice(0, 1)]);
    }
    // Obligatoire si un schéma le dit ; facultative s'il ne dit que cela.
    const required = new Map<string, boolean>();
    for (const t of rows("env_required")) if (files.includes(s(t.args[0]))) {
      const n = s(t.args[1]);
      required.set(n, (required.get(n) ?? false) || s(t.args[2]) === "yes");
    }
    for (const t of rows("env_read")) if (files.includes(s(t.args[0])) && env.has(s(t.args[1]))) {
      const n = s(t.args[1]);
      env.set(n, dedupe([...env.get(n)!, at(s(t.args[0]), Number(t.args[2]), t.proof)]));
    }

    // Une validation de l'environnement au chargement, et les fichiers du déployable qui la chargent par leurs imports.
    const loadChecks = rows("env_check_at_load").filter((t) => files.includes(s(t.args[0]))).map((t) => {
      const file = s(t.args[0]);
      const loadedBy = new Set<string>();
      const queue = [file];
      while (queue.length) {
        const f = queue.pop()!;
        for (const i of rows("imports")) if (s(i.args[2]) === f && files.includes(s(i.args[0])) && !loadedBy.has(s(i.args[0])) && s(i.args[0]) !== file) {
          loadedBy.add(s(i.args[0]));
          queue.push(s(i.args[0]));
        }
      }
      const req = rows("env_required").filter((r) => s(r.args[0]) === file && s(r.args[2]) === "yes").map((r) => s(r.args[1]));
      return { proof: at(file, Number(t.args[1]), t.proof), required: [...new Set(req)].sort(), loadedBy: [...loadedBy].sort() };
    });

    // Comment un appelant prouve qui il est : un mécanisme par nom, avec chaque ligne qui le lit.
    const trust = new Map<string, Proof>();
    for (const t of rows("trust")) if (files.includes(s(t.args[0])) && !trust.has(s(t.args[1]))) trust.set(s(t.args[1]), at(s(t.args[0]), Number(t.args[2]), t.proof));

    const instances = rows("unit_instances").find((t) => list.some((u) => u.name === s(t.args[1]) && u.proof.some((p) => p.path === s(t.args[0]))));

    const attributes = dedupeAttrs(rows("unit_attr").filter((t) => list.some((u) => u.name === s(t.args[1]) && u.proof.some((p) => p.path === s(t.args[0]))))
      .map((t) => ({ key: s(t.args[2]), value: s(t.args[3]), proof: first(t.proof)! })));

    const node: ArchNode = {
      id,
      name: best.name,
      level: "deployable",
      role,
      ...(tech.size ? { tech: [...tech].sort() } : {}),
      subtitle: read.has(target) ? target : `${target} · langage non lu`,
      status: "extracted",
      proof: dedupe(list.flatMap((u) => u.proof)),
      ...(files.length ? { files } : {}),
      ...(instances ? { instances: { min: Number(instances.args[2]), proof: first(instances.proof)! } } : {}),
      ...(attributes.length ? { attributes } : {}),
      facets: {
        ...(entrypoints.length ? { entrypoints } : {}),
        ...(env.size ? { config: {
          env: [...env].sort(([a], [b]) => a.localeCompare(b)).map(([name, readAt]) => ({ name, readAt, ...(required.has(name) ? { required: required.get(name)! } : {}) })),
          ...(loadChecks.length ? { loadChecks } : {}),
        } } : {}),
        ...(trust.size ? { trust: { mechanisms: [...trust].sort(([a], [b]) => a.localeCompare(b)).map(([name, proof]) => ({ name, proof })) } } : {}),
      },
    };
    if (!read.has(target)) coverageGaps.push({ kind: "language_not_read", subject: target, count: 1, proof: node.proof[0]! });
    nodes.push(node);
    if (best.kind === "image") fromImage.add(id);
  }

  // Un programme lancé par une image prend le nom que lui donne son paquet : le script qui le lance (`start:ingestion-worker`),
  // ou le nom du paquet pour son script principal. Plusieurs programmes d'un même manifeste qui gardent le même nom
  // reçoivent en plus le fichier qu'ils lancent.
  const deployables = nodes.filter((n) => n.level === "deployable");
  const targetOf = (x: ArchNode) => x.subtitle!.split(" · ")[0]!;
  for (const n of deployables) if (fromImage.has(n.id)) n.name = packageName(rows, targetOf(n)) ?? n.name;
  const short = (x: ArchNode) => targetOf(x).split("/").pop()!.replace(/\.[cm]?[jt]sx?$/, "");
  const renamed = deployables.map((n) => {
    const twins = deployables.filter((o) => o.name === n.name);
    if (twins.length < 2) return n.name;
    return `${n.name} (${twins.filter((o) => short(o) === short(n)).length > 1 ? targetOf(n) : short(n)})`;
  });
  deployables.forEach((n, i) => { n.name = renamed[i]!; });

  /* --- Stockages et canaux : par image, par pilote, par entités déclarées ---- */
  const stores = new Map<string, { name?: string; display?: string; role?: ArchNode["role"]; shape?: string; proof: Proof[] }>();
  const store = (tech: string) => stores.get(tech) ?? stores.set(tech, { proof: [] }).get(tech)!;
  const imageInfo = new Map(rows("image_store").map((t) => [s(t.args[0]), { tech: s(t.args[1]), role: s(t.args[2]) as ArchNode["role"], shape: s(t.args[3]) }]));
  const built = new Set(rows("unit_build").map((t) => `${s(t.args[0])}\0${s(t.args[1])}`));
  for (const t of rows("unit_image")) {
    const [file, svc, image] = t.args.map(s) as [string, string, string];
    const info = imageInfo.get(image);
    if (!info || built.has(`${file}\0${svc}`)) continue;
    const st = store(info.tech);
    st.name ??= svc;
    st.role ??= info.role;
    st.shape ??= info.shape;
    st.proof.push(...t.proof.slice(0, 1));
  }
  for (const t of rows("store_decl")) {
    // Un produit géré n'a pas de nom de service : son identifiant est sa technologie, son nom celui du produit.
    const st = store(s(t.args[1]));
    st.display ??= s(t.args[4]);
    st.role ??= s(t.args[2]) as ArchNode["role"];
    st.shape ??= s(t.args[3]);
    st.proof.push(...t.proof.slice(0, 1));
  }
  for (const t of rows("uses_store")) store(s(t.args[1])).proof.push(...t.proof.filter((p) => !p.path.match(/Dockerfile|\.toml$|\.ya?ml$/)).slice(0, 1));
  const entities = new Map<string, { name: string; proof: Proof }[]>();
  for (const t of rows("entity_def")) {
    const tech = s(t.args[0]);
    const st = store(tech);
    st.shape ??= s(t.args[1]);
    (entities.get(tech) ?? entities.set(tech, []).get(tech)!).push({ name: s(t.args[2]), proof: t.proof.find((p) => p.path === s(t.args[3])) ?? t.proof[0]! });
  }
  // Une entité vue seulement à l'usage (une requête SQL, une collection) : ajoutée si rien ne la déclare.
  for (const t of rows("entity_seen")) {
    const tech = s(t.args[0]);
    const st = store(tech);
    st.shape ??= s(t.args[1]);
    const list = entities.get(tech) ?? entities.set(tech, []).get(tech)!;
    if (!list.some((e) => e.name === s(t.args[2]))) list.push({ name: s(t.args[2]), proof: t.proof.find((p) => p.path === s(t.args[3])) ?? t.proof[0]! });
  }
  const ruleOf = new Map(rows("entity_rule").map((t) => [`${s(t.args[1])}\0${s(t.args[2])}`, t.proof[0]!]));
  for (const t of rows("entity_rule")) {
    const tech = s(t.args[1]);
    const list = entities.get(tech) ?? entities.set(tech, []).get(tech)!;
    if (!list.some((e) => e.name === s(t.args[2]))) list.push({ name: s(t.args[2]), proof: t.proof[0]! });
  }
  const detailOf = entityDetails(db);
  const sections = new Map<string, { title: string; line: number }[]>();
  for (const t of rows("section")) {
    const file = s(t.args[0]);
    (sections.get(file) ?? sections.set(file, []).get(file)!).push({ title: s(t.args[1]), line: Number(t.args[2]) });
  }
  // La section d'une entité : le dernier commentaire de séparation au-dessus de sa déclaration.
  const groupOf = (p?: Proof) => p && sections.get(p.path)?.filter((x) => x.line < p.line).sort((a, b) => b.line - a.line)[0]?.title;
  const topics = new Map<string, { name: string; proof: Proof }[]>();
  for (const t of rows("channel_topic")) {
    const tech = s(t.args[2]);
    store(tech);
    const list = topics.get(tech) ?? topics.set(tech, []).get(tech)!;
    if (!list.some((x) => x.name === s(t.args[1]))) list.push({ name: s(t.args[1]), proof: t.proof[0]! });
  }
  const topicTech = new Map([...topics].flatMap(([tech, list]) => list.map((x) => [x.name, tech] as const)));

  for (const [tech, st] of [...stores].sort(([a], [b]) => a.localeCompare(b))) {
    const id = st.name && !usedIds.has(st.name) ? st.name : `${tech}`;
    usedIds.add(id);
    nodeIdOf.set(`store:${tech}`, id);
    const ents = entities.get(tech);
    const tops = topics.get(tech);
    nodes.push({
      id,
      name: st.name ?? st.display ?? tech,
      level: "deployable",
      role: tops?.length && !ents?.length ? "channel" : st.role ?? "store",
      tech: [tech],
      status: "extracted",
      proof: dedupe(st.proof.length ? st.proof : [...(ents?.map((e) => e.proof) ?? []), ...(tops?.map((x) => x.proof) ?? [])].slice(0, 1)),
      facets: {
        ...(ents?.length ? { data: { shape: (st.shape ?? "unknown") as "relational", entities: dedupeBy(ents, (e) => e.name).sort((a, b) => a.name.localeCompare(b.name)).map((e) => {
          const rule = ruleOf.get(`${tech}\0${e.name}`);
          const group = groupOf(e.proof);
          return { name: e.name, ...(group ? { group } : {}), ...detailOf(tech, e.name), ...(rule ? { rule } : {}), proof: e.proof };
        }) } } : {}),
        ...(tops?.length ? { channel: { shape: "queue" as const, topics: tops.map((x) => ({ name: x.name, proof: x.proof })) } } : {}),
      },
    });
  }

  /* --- Services externes ------------------------------------------------------ */
  const externalInfo = new Map(rows("external_pkg").map((t) => [s(t.args[0]), { name: s(t.args[1]), tech: s(t.args[2]) }]));
  const externalClients = new Map<string, Proof[]>();
  for (const t of rows("client")) {
    const pkg = s(t.args[1]);
    if (!externalInfo.has(pkg)) continue;
    externalClients.set(pkg, [...(externalClients.get(pkg) ?? []), ...t.proof.slice(0, 1)]);
  }
  for (const [pkg, proof] of [...externalClients].sort(([a], [b]) => a.localeCompare(b))) {
    const info = externalInfo.get(pkg)!;
    const id = usedIds.has(info.tech) ? `external:${info.tech}` : info.tech;
    usedIds.add(id);
    nodeIdOf.set(`external:${pkg}`, id);
    nodes.push({ id, name: info.name, level: "system", role: "external", tech: [info.tech], status: "extracted", proof: dedupe(proof), facets: {} });
  }

  /* --- Liens -------------------------------------------------------------------- */
  const edges = new Map<string, ArchEdge>();
  const edge = (from: string, to: string, kind: EdgeKind, target: ArchEdge["target"] | undefined, occ: Occurrence) => {
    const id = `${from}>${kind}>${to}${target ? `#${Object.values(target)[0]}` : ""}`;
    const e = edges.get(id) ?? edges.set(id, { id, from, to, kind, ...(target ? { target } : {}), count: 0, occurrences: [] }).get(id)!;
    if (e.occurrences.some((o) => o.path === occ.path && o.line === occ.line)) return;
    e.count++;
    if (e.occurrences.length < 60) e.occurrences.push(occ);
  };

  // Ce que le dépôt contient sans qu'un pack le lise : sur la carte, marqué « non lu » (unread.ts).
  const unreadGaps = addUnread({
    db, present, nodes, usedIds, edge,
    reached: new Set([...reachOf.values()].flat()),
    packTech: new Set(opts.packs.flatMap((p) => p.tech)),
    deployablesOf: (file) => deployableOf(file).map((r) => nodeIdOf.get(r)!),
  });

  for (const t of rows("accesses")) {
    const [file, op, tech, entity] = t.args.map(s) as [string, "read" | "write", string, string];
    const to = nodeIdOf.get(`store:${tech}`);
    if (!to) continue;
    for (const r of deployableOf(file)) edge(nodeIdOf.get(r)!, to, op, { entity }, at(file, Number(t.args[4]), t.proof));
  }
  for (const t of rows("publishes")) {
    const [file, topic] = t.args.map(s) as [string, string];
    const to = nodeIdOf.get(`store:${topicTech.get(topic)}`);
    if (!to) continue;
    for (const r of deployableOf(file)) edge(nodeIdOf.get(r)!, to, "message", { topic }, t.proof.find((p) => p.path === file) ?? t.proof[0]!);
  }
  for (const t of rows("subscribes")) {
    const [file, topic] = t.args.map(s) as [string, string];
    const from = nodeIdOf.get(`store:${topicTech.get(topic)}`);
    if (!from) continue;
    for (const r of deployableOf(file)) {
      const id = nodeIdOf.get(r)!;
      edge(from, id, "trigger", { entrypoint: `${id}:message:${topic}` }, t.proof[0]!);
    }
  }
  for (const t of rows("trigger_on")) {
    const [file, key, tech] = t.args.map(s) as [string, string, string];
    const from = nodeIdOf.get(`store:${tech}`);
    if (!from) continue;
    for (const r of deployableOf(file)) {
      const id = nodeIdOf.get(r)!;
      const entry = nodes.find((n) => n.id === id)?.facets.entrypoints?.find((e) => e.key === key && e.proof.path === file);
      if (entry) edge(from, id, "trigger", { entrypoint: entry.id }, t.proof[0]!);
    }
  }
  for (const t of rows("calls_external")) {
    const [file, pkg] = t.args.map(s) as [string, string];
    const to = nodeIdOf.get(`external:${pkg}`);
    if (!to) continue;
    for (const r of deployableOf(file)) edge(nodeIdOf.get(r)!, to, "request", undefined, at(file, Number(t.args[2]), t.proof));
  }
  for (const t of rows("client")) {
    const [file, pkg] = t.args.map(s) as [string, string];
    const to = nodeIdOf.get(`external:${pkg}`);
    if (!to) continue;
    for (const r of deployableOf(file)) edge(nodeIdOf.get(r)!, to, "request", undefined, t.proof[0]!);
  }

  /* --- Contrats : une interface du dépôt implémentée au moins deux fois ---------- */
  const impls = new Map<string, { name: string; path: string; line: number }[]>();
  for (const t of rows("implements_at")) {
    const k = `${s(t.args[2])}\0${s(t.args[3])}`;
    const list = impls.get(k) ?? impls.set(k, []).get(k)!;
    if (!list.some((x) => x.name === s(t.args[1]))) list.push({ name: s(t.args[1]), path: s(t.args[0]), line: Number(t.args[4]) });
  }
  const contractOf = contractDetails(db);
  for (const [k, list] of [...impls].sort(([a], [b]) => a.localeCompare(b))) {
    if (list.length < 2) continue;
    const [file, iface] = k.split("\0") as [string, string];
    const def = rows("interface_def").find((t) => s(t.args[0]) === file && s(t.args[1]) === iface)!;
    const sel = rows("selects").find((t) => s(t.args[2]) === file && s(t.args[3]) === iface);
    const selFile = sel ? s(sel.args[0]) : undefined;
    const selLine = sel ? Number(rows("defines").find((t) => s(t.args[0]) === selFile && s(t.args[1]) === s(sel.args[1]))?.args[2] ?? 1) : 0;
    const config = selFile ? [...new Set(rows("env_read").filter((t) => s(t.args[0]) === selFile).map((t) => s(t.args[1])))].sort() : [];
    const dir = file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : "";
    const anchor = selFile ?? list[0]!.path;
    const parentTarget = [...reachOf].find(([, fs]) => fs.includes(anchor))?.[0];
    let id = dir.split("/").pop() || iface;
    if (usedIds.has(id)) id = `${id}:${iface}`;
    usedIds.add(id);
    nodes.push({
      id,
      name: dir || iface,
      level: "component",
      role: "module",
      ...(parentTarget ? { parent: nodeIdOf.get(parentTarget)! } : {}),
      status: "extracted",
      proof: [def.proof[0]!],
      files: [...read].filter((f) => dir && f.startsWith(`${dir}/`) && !f.slice(dir.length + 1).includes("/")).sort(),
      facets: {
        contract: [((d) => ({
          name: iface,
          interface: { path: file, line: Number(def.args[2]), name: iface },
          ...(d.summary ? { summary: d.summary } : {}),
          operations: d.operations.length ? d.operations : rows("interface_member").filter((t) => s(t.args[0]) === file && s(t.args[1]) === iface).map((t) => ({ name: s(t.args[2]), line: Number(t.args[3]) })),
          implementations: d.implementations,
          ...(sel ? { selector: { symbol: { path: selFile!, line: selLine, name: s(sel.args[1]) }, ...(config.length ? { config } : {}), ...(d.choices ? { choices: d.choices } : {}) } } : {}),
          ...(d.sealed ? { sealed: d.sealed } : {}),
        }))(contractOf({ file, iface, impls: list, ...(sel ? { selector: { file: selFile!, fn: s(sel.args[1]) } } : {}) }))],
      },
    });
  }

  /* --- Appels HTTP entre déployables : même méthode, même chemin ---------------- */
  const norm = (p: string) => p.replace(/:[A-Za-z_]\w*/g, ":param").replace(/\/+$/, "") || "/";
  const routes = new Map<string, { node: ArchNode; entry: Entrypoint }[]>();
  for (const n of nodes) for (const e of n.facets.entrypoints ?? []) {
    if (e.kind !== "http") continue;
    const [method, path] = e.key.split(" ") as [string, string | undefined];
    if (path === undefined) continue;
    const k = `${method} ${norm(path)}`;
    (routes.get(k) ?? routes.set(k, []).get(k)!).push({ node: n, entry: e });
  }
  for (const t of rows("http_call")) {
    const [file, method, path] = t.args.map(s) as [string, string, string];
    // Une route dont la méthode n'est pas écrite (`ANY`) répond à toutes.
    for (const { node, entry } of [...(routes.get(`${method} ${norm(path)}`) ?? []), ...(routes.get(`ANY ${norm(path)}`) ?? [])]) {
      for (const r of deployableOf(file)) {
        const from = nodeIdOf.get(r)!;
        if (from === node.id) continue;
        edge(from, node.id, "call", { entrypoint: entry.id }, at(file, Number(t.args[3]), t.proof));
        entry.calledBy = [...new Set([...(entry.calledBy ?? []), from])].sort();
      }
    }
  }

  /* --- La garde de chaque point d'entrée, quand un pack sait la lire --------------- */
  // entry_guard(Fichier, Ligne, role|auth, FichierGarde, LigneGarde) ; guards_read(Fichier, Ligne) : sans garde trouvée, l'entrée est publique.
  const definedAt = new Map<string, string>();
  for (const t of rows("defines")) {
    const k = `${s(t.args[0])}:${s(t.args[2])}`;
    if (s(t.args[1]) !== "default" || !definedAt.has(k)) definedAt.set(k, s(t.args[1]));
  }
  const guardOf = new Map<string, NonNullable<Entrypoint["access"]>>();
  for (const t of rows("entry_guard")) {
    const k = `${s(t.args[0])}:${s(t.args[1])}`;
    const level = s(t.args[2]) === "role" ? "role" : "authenticated";
    if (guardOf.get(k)?.level === "role") continue;
    const [path, line] = [s(t.args[3]), Number(t.args[4])];
    guardOf.set(k, { level, by: { path, line, name: definedAt.get(`${path}:${line}`) ?? "fonction anonyme" }, proof: { path, line, source: "pack" } });
  }
  const guardsRead = new Set(rows("guards_read").map((t) => `${s(t.args[0])}:${s(t.args[1])}`));
  for (const n of nodes) for (const e of n.facets.entrypoints ?? []) {
    const k = `${e.proof.path}:${e.proof.line}`;
    const g = guardOf.get(k);
    if (g) e.access = { ...g, proof: { ...g.proof!, pack: e.proof.pack } };
    else if (guardsRead.has(k)) e.access = { level: "public" };
  }

  /* --- Appels entrants d'un service externe : le code vérifie sa signature ------- */
  for (const t of rows("inbound_from")) {
    const [file, pkg] = t.args.map(s) as [string, string];
    const from = nodeIdOf.get(`external:${pkg}`);
    if (!from) continue;
    const proof = at(file, Number(t.args[2]), t.proof);
    // La route dont le code contient la vérification : la dernière du fichier qui commence avant elle.
    const before = nodes.flatMap((n) => n.facets.entrypoints ?? []).filter((e) => e.handler?.path === file && e.handler.line <= proof.line);
    const start = Math.max(...before.map((e) => e.handler!.line));
    for (const n of nodes) for (const e of n.facets.entrypoints ?? []) {
      if (e.handler?.path !== file || e.handler.line !== start) continue;
      e.access = { level: "signature", proof };
      e.calledBy = [...new Set([...(e.calledBy ?? []), from])].sort();
      edge(from, n.id, "call", { entrypoint: e.id }, proof);
    }
  }

  /* --- Ce que chaque point d'entrée exécute, et ce qu'il lit, écrit, publie ------- */
  const depends = new Map<string, string[]>();
  for (const t of rows("depends")) {
    const [from, to] = [s(t.args[0]), s(t.args[1])];
    (depends.get(from) ?? depends.set(from, []).get(from)!).push(to);
  }
  const importedBy = new Map<string, string[]>();
  for (const t of rows("imports")) {
    const k = `${s(t.args[2])}\0${s(t.args[3])}`;
    (importedBy.get(k) ?? importedBy.set(k, []).get(k)!).push(s(t.args[0]));
  }
  const importers = (path: string, fn: string) => [...new Set(importedBy.get(`${path}\0${fn}`) ?? [])];
  const graph = fnGraph(rows);
  const { reaches, owners } = attributeEntrypoints(nodes, [...edges.values()], depends, graph, importers);
  attributeFieldWrites(nodes, importers, owners);
  attributeFlows(nodes, [...edges.values()], rows);
  attributeFunctions(nodes, [...edges.values()], rows);
  // Les composants, une fois les occurrences rattachées : leurs liens entre eux ne sont pas des étapes de déroulé.
  for (const e of attributeComponents(nodes, [...edges.values()], graph, reaches)) edges.set(e.id, e);

  /* --- Constats établis sur la carte (docs/fonctionnement/constats.md) ------------- */
  const findings: Finding[] = [];
  // Une route qu'aucun code du dépôt n'appelle : seulement pour un service dont le dépôt contient au moins un client.
  const unreadCalls = rows("http_unread").length;
  const HEALTH = /^\/(health|healthz|livez|readyz|ping)$/;
  for (const n of nodes) {
    const http = (n.facets.entrypoints ?? []).filter((e) => e.kind === "http");
    const fromRepo = (e: Entrypoint) => (e.calledBy ?? []).some((c) => nodes.find((x) => x.id === c)?.level === "deployable");
    if (!http.some(fromRepo)) continue;
    for (const e of http) {
      if (e.calledBy?.length || HEALTH.test(e.key.split(" ")[1] ?? "")) continue;
      const unread = unreadCalls ? `, mais ${unreadCalls} appel${unreadCalls > 1 ? "s" : ""} HTTP du dépôt n'${unreadCalls > 1 ? "ont" : "a"} pas pu être lu${unreadCalls > 1 ? "s" : ""}` : "";
      findings.push({ code: "uncalled_entry", message: `« ${e.key} » : aucun code du dépôt n'appelle cette route${unread}`, proof: [e.proof], nodes: [n.id], source: e.proof.source });
    }
  }
  // Des tâches planifiées sur un déployable à plusieurs instances : chacune s'exécute autant de fois.
  for (const n of nodes) {
    const tasks = (n.facets.entrypoints ?? []).filter((e) => e.kind === "schedule");
    if (!tasks.length || !n.instances || n.instances.min < 2) continue;
    const k = tasks.length, min = n.instances.min;
    findings.push({
      code: "scheduled_on_every_instance",
      message: `${k > 1 ? `les ${k} tâches planifiées` : "la tâche planifiée"} de ${n.name} démarre${k > 1 ? "nt" : ""} sur chacune de ses ${min} instances : chaque tâche s'exécute ${min} fois`,
      proof: dedupe([...tasks.map((e) => e.proof), n.instances.proof]),
      nodes: [n.id],
      source: tasks[0]!.proof.source,
    });
  }

  // Les constats établis par les règles des packs : finding(Code, Sujet, Détail, Fichier, Ligne).
  const storeOfFinding = new Map<string, string[]>();
  for (const t of rows("finding_store")) {
    const k = `${s(t.args[0])}\0${s(t.args[1])}`;
    const id = nodeIdOf.get(`store:${s(t.args[2])}`);
    if (id) storeOfFinding.set(k, [...(storeOfFinding.get(k) ?? []), id]);
  }
  const nameOfNode = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  // Les lignes qu'une règle désigne comme fondant un constat : elles remplacent ses preuves de contexte.
  const named = new Map<string, Proof[]>();
  for (const t of rows("finding_proof")) {
    const k = t.args.slice(0, 5).map(s).join("\0");
    named.set(k, [...(named.get(k) ?? []), at(s(t.args[5]), Number(t.args[6]), t.proof)]);
  }
  for (const t of rows("finding")) {
    const [code, subject, detail, file] = t.args.map(s) as [Finding["code"], string, string, string];
    const line = Number(t.args[4]);
    const stores = storeOfFinding.get(`${code}\0${subject}`) ?? [];
    const chosen = named.get(t.args.map(s).join("\0"));
    const others = (chosen ?? t.proof).filter((p) => !(p.path === file && p.line === line));
    const proof = dedupe([at(file, line, [...t.proof, ...(chosen ?? [])]), ...(chosen ? [...others].sort((a, b) => Number(a.path !== file) - Number(b.path !== file) || a.path.localeCompare(b.path) || a.line - b.line) : others)]);
    const message = findingMessage(code, detail, stores[0] ? nameOfNode(stores[0]) : subject);
    if (findings.some((f) => f.code === code && f.message === message && f.proof[0]!.path === file && f.proof[0]!.line === line)) continue;
    findings.push({ code, message, proof, nodes: [...deployableOf(file).map((r) => nodeIdOf.get(r)!), ...stores], source: proof[0]!.source });
  }

  /* --- Couverture ------------------------------------------------------------------ */
  const manifests = new Set(rows("unit").map((t) => s(t.args[0])));
  const unread = [...present].filter((f) => UNREAD_CODE.test(f));
  const byExt = new Map<string, number>();
  for (const f of unread) byExt.set(f.slice(f.lastIndexOf(".")), (byExt.get(f.slice(f.lastIndexOf("."))) ?? 0) + 1);
  const packTech = new Set(opts.packs.flatMap((p) => p.tech));
  const missing = new Map<string, { count: number; proof: Proof; where: Proof[] }>();
  for (const t of rows("imports_pkg")) {
    for (const entry of techsForPackage("npm", s(t.args[2]))) {
      if (!TECH_CATEGORIES.has(entry.category) || entry.category === "framework" || packTech.has(entry.id)) continue;
      const m = missing.get(entry.name);
      if (m) { m.count++; m.where.push(t.proof[0]!); }
      else missing.set(entry.name, { count: 1, proof: t.proof[0]!, where: [t.proof[0]!] });
    }
  }
  const coverage: Coverage[] = [
    { level: "deployable", unit: "manifests", read: manifests.size, total: manifests.size, gaps: coverageGaps },
    {
      level: "component",
      unit: "files",
      read: [...present].filter((f) => read.has(f) && !manifests.has(f)).length,
      understood: [...new Set([...reachOf.values()].flat())].filter((f) => present.has(f) && read.has(f) && !manifests.has(f)).length,
      total: [...present].filter((f) => (read.has(f) && !manifests.has(f)) || UNREAD_CODE.test(f)).length,
      gaps: [
        ...[...byExt].sort().map(([ext, count]) => ({ kind: "language_not_read" as const, subject: `fichiers ${ext}`, count, where: unread.filter((f) => f.endsWith(ext)).sort().map((path) => ({ path, line: 0, source: "syntax" as const })) })),
        ...[...missing].sort(([a], [b]) => a.localeCompare(b)).map(([name, m]) => ({ kind: "pack_missing" as const, subject: name, count: m.count, proof: m.proof, where: dedupe(m.where) })),
        ...unreadGaps,
        ...unresolvedGaps(rows("unresolved")),
        // Un pack qui a échoué sur des fichiers : ce qu'il aurait lu là manque, et la carte le dit au lieu de tomber.
        ...[...rows("pack_failed").reduce((m, t) => m.set(s(t.args[0]), [...(m.get(s(t.args[0])) ?? []), t]), new Map<string, ReturnType<typeof rows>>())]
          .map(([pack, ts]) => ({ kind: "pack_failed" as const, subject: `${pack} : ${s(ts[0]!.args[2])}`, count: ts.length, proof: ts[0]!.proof[0]!, where: dedupe(ts.map((t) => t.proof[0]!)) })),
      ],
    },
  ];

  return {
    version: 2,
    system: { name: opts.name },
    nodes,
    edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id)),
    findings,
    coverage,
  };
}

/**
 * Le nom qu'un paquet donne au programme qui lance ce fichier : le script du paquet le plus proche qui le lance,
 * sans `start:` ni `:dev` (`start:ingestion-worker:dev` → `ingestion-worker`), ou le nom du paquet pour son script
 * principal (`start`, `dev`, `serve`).
 */
function packageName(rows: (rel: string) => readonly { args: readonly Value[] }[], target: string): string | undefined {
  const names = new Map(rows("pkg_name").map((t) => [String(t.args[0]), String(t.args[1])]));
  const dirOf = (k: string) => (k.includes("/") ? k.slice(0, k.lastIndexOf("/") + 1) : "");
  const scripts = rows("pkg_script").filter((t) => String(t.args[2]) === target && target.startsWith(dirOf(String(t.args[0]))))
    .sort((a, b) => dirOf(String(b.args[0])).length - dirOf(String(a.args[0])).length);
  const nearest = scripts.filter((t) => dirOf(String(t.args[0])) === dirOf(String(scripts[0]?.args[0] ?? "")));
  if (!nearest.length) return undefined;
  const clean = nearest.map((t) => String(t.args[1]).replace(/^(start|run|serve):/, "").replace(/:(dev|prod|watch)$/, ""));
  const own = clean.find((c) => !/^(start|dev|serve|main|prod|watch)$/.test(c));
  return own ?? (shortName(names.get(String(nearest[0]!.args[0])) ?? "") || undefined);
}

/** Le texte d'un constat établi par les règles : son code, le détail que la règle donne, le nom de ce qu'il concerne. */
function findingMessage(code: string, detail: string, subject: string): string {
  const text: Record<string, Record<string, string>> = {
    missing_timeout: {
      connect: `la connexion à ${subject} n'a aucun délai maximum : si la base ne répond plus, la connexion et les requêtes attendent sans fin`,
      retry: `les commandes vers ${subject} sont rejouées sans limite et sans délai : pendant une coupure, elles attendent sans fin`,
    },
    personal_data_logged: {
      body: "le corps entier d'une requête HTTP est écrit dans le journal : tout ce que le client envoie, données personnelles comprises",
      field: `le champ « ${subject} » est écrit dans le journal`,
    },
    unguarded_route: {
      auth: `« ${subject} » : le chemin dit admin, mais la route n'est gardée que par une connexion (401), sans garde de rôle (403)`,
      none: `« ${subject} » : le chemin dit admin, mais aucune garde lue ne vérifie un rôle (aucune fonction du dépôt qui réponde 403)`,
    },
    write_then_enqueue: {
      tx: `la donnée est écrite dans une transaction, puis le message « ${subject} » est publié après elle : si la publication échoue, l'écriture reste`,
      plain: `la donnée est écrite, puis le message « ${subject} » est publié sans transaction commune : si la publication échoue, l'écriture reste`,
    },
    dead_code: { fn: `\`${subject}\` est exportée, mais aucun fichier du dépôt ne l'importe et son fichier ne l'emploie pas` },
  };
  // Le détail est ici la valeur elle-même, ou la colonne (table.colonne).
  if (code === "unused_value") return `${subject} accepte « ${detail} », que rien n'écrit`;
  if (code === "race_read_then_write") {
    const [table, col] = [detail.slice(0, detail.lastIndexOf(".")), detail.slice(detail.lastIndexOf(".") + 1)];
    return `\`${subject}\` lit des lignes de ${table} filtrées sur \`${col}\`, puis les met à jour sans revérifier \`${col}\`, alors qu'un autre code écrit \`${col}\` entre-temps`;
  }
  return text[code]?.[detail] ?? `${code} : ${subject}`;
}

/** Ce qu'un pack a reconnu sans pouvoir le relier, par genre : `path_dynamic`, `target_unknown`. */
function unresolvedGaps(rows: readonly { args: readonly Value[]; proof: readonly Proof[] }[]): Coverage["gaps"] {
  const by = new Map<string, Proof[]>();
  for (const t of rows) {
    const kind = String(t.args[1]);
    const p = t.proof.find((x) => x.path === String(t.args[0]) && x.line === Number(t.args[2])) ?? t.proof[0]!;
    const list = by.get(kind) ?? by.set(kind, []).get(kind)!;
    if (!list.some((x) => x.path === p.path && x.line === p.line)) list.push(p);
  }
  const label: Record<string, string> = { path_dynamic: "chemins calculés à l'exécution", target_unknown: "cibles inconnues" };
  return [...by].sort(([a], [b]) => a.localeCompare(b)).map(([kind, list]) => ({ kind: kind as "path_dynamic", subject: label[kind] ?? kind, count: list.length, proof: list[0]!, where: list }));
}

function dedupe(proof: Proof[]): Proof[] {
  return dedupeBy(proof, (p) => `${p.path}:${p.line}`);
}

function dedupeBy<T>(list: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  return list.filter((x) => (seen.has(key(x)) ? false : (seen.add(key(x)), true)));
}

/** Un même attribut écrit deux fois (une app et ses groupes) n'est gardé qu'une fois. */
function dedupeAttrs(list: { key: string; value: string; proof: Proof }[]): { key: string; value: string; proof: Proof }[] {
  return list.filter((a, i) => list.findIndex((b) => b.key === a.key && b.value === a.value) === i);
}
