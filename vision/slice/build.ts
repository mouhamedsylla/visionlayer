import type { CodeFunction, FlowStep, Occurrence, Proof } from "../arch/types.js";
import type { KnowledgeReport } from "../knowledge/types.js";
import { at, MapIndex, type IndexedEntity, type IndexedEntry } from "./index.js";
import { resolve, type Start } from "./resolve.js";
import { guardText } from "./summary.js";

/** Une ligne de la tranche : une adresse à lire, ce qu'on y trouve, et sa distance au départ choisi. */
export interface SliceItem {
  dist: number;
  section: string;
  at: string;
  text: string;
}

export interface Slice {
  items: SliceItem[];
  /** Ce qui n'a pas pu être retrouvé sur la carte. */
  unknown: string[];
}

function stepText(s: FlowStep): string | undefined {
  const target = s.target ? `${s.target.node}${s.target.entity ? "/" + s.target.entity : ""}${s.target.topic ? "/" + s.target.topic : ""}` : "";
  switch (s.kind) {
    case "invoke": return `appelle ${s.name}`;
    case "refuse": return `refuse ${[s.status, s.code].filter(Boolean).join(" ") || `(${s.name ?? "erreur"})`}${s.when ? ` si ${s.when}` : ""}${s.onError ? " (sur échec de l'appel précédent)" : ""}`;
    case "read": return `lit ${target}`;
    case "write": return `écrit ${target}`;
    case "message": return `dépose un message dans ${target}`;
    case "request": case "call": return `appelle ${target}${s.name ? " " + s.name : ""}`;
    case "trigger": return `déclenche ${target}`;
    case "reply": return `répond${s.status ? " " + s.status : ""}`;
    default: return undefined;
  }
}

/**
 * La tranche du système autour de ce que l'agent a choisi : des adresses à
 * lire, rangées de la plus proche à la plus lointaine, sans code. Les règles
 * de parcours sont les mêmes pour tout projet (docs : contexte-des-agents-solution) :
 *
 * - un point d'entrée donne sa fonction, sa garde, ce qui le déclenche et son déroulé ;
 * - une donnée écrite donne ses autres écrivains (avec la valeur écrite quand elle est littérale), puis ses lecteurs ;
 * - une donnée seulement lue donne ses écrivains ;
 * - un message déposé donne qui le traite ;
 * - s'y ajoutent les constats et les déclarations des agents qui touchent une fonction de la tranche,
 *   et ce qui n'est pas lu dans ses fichiers.
 */
export function buildSlice(index: MapIndex, handles: string[], opts: { knowledge?: KnowledgeReport } = {}): Slice {
  const items: SliceItem[] = [];
  const seen = new Set<string>();
  const fns = new Map<string, CodeFunction>();
  const entriesIn = new Set<string>();
  const written = new Set<string>(), read = new Set<string>(), sent = new Set<string>(), startEntities = new Set<string>();
  /** Les données que le départ lui-même touche (distance 0). */
  const touched = new Set<string>();
  const unknown: string[] = [];

  /** Les points d'entrée dont une ligne proche (distance 0 ou 1) passe par la tranche. */
  const related = new Set<string>();
  const add = (dist: number, section: string, p: { path: string; line: number } | undefined, text: string) => {
    if (dist <= 1) for (const id of (p as Occurrence | undefined)?.entrypoints ?? []) related.add(id);
    const where = p ? at(p) : "";
    const key = `${where} ${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ dist, section, at: where, text });
  };
  const keepFn = (p: { path: string; line: number }) => {
    const f = index.functionAt(p);
    if (f) fns.set(f.id, f);
  };
  const entryNames = (ids: string[] | undefined) => (ids ?? []).map((id) => index.entryById(id)).filter((e): e is IndexedEntry => !!e).map((e) => index.entryName(e));
  /** Les valeurs littérales qu'une fonction écrit dans une table : `status = cancelled`. Une valeur calculée n'apprend rien ici. */
  const values = new Map<string, string[]>();
  for (const t of index.entities) for (const f of t.fields ?? []) for (const w of f.writes ?? []) {
    if (w.value === undefined || !w.fn) continue;
    const k = `${t.name}|${w.fn}`;
    values.set(k, [...(values.get(k) ?? []), `${f.name} = ${w.value}`]);
  }
  /** Les champs qu'une lecture rend, à son adresse : `email, name, phone`, ou la ligne entière. */
  const readCols = new Map<string, string[]>();
  for (const t of index.entities) for (const f of t.fields ?? []) for (const r of f.reads ?? []) {
    const k = `${t.name}|${at(r.proof)}`;
    readCols.set(k, [...(readCols.get(k) ?? []), r.whole ? "*" : f.name]);
  }
  /** `écrit bookings (status = confirmed) dans confirmBooking, depuis POST /webhooks/stripe` ; `lit users (email, phone) dans exportUsers` */
  const occurrenceText = (verb: string, entity: string, o: Occurrence) => {
    const fn = index.functionAt(o)?.name;
    const cols = verb === "lit" ? [...new Set(readCols.get(`${entity}|${at(o)}`) ?? [])] : [];
    const written = cols.includes("*") ? ["toute la ligne"] : cols.length ? cols : [...new Set(values.get(`${entity}|${fn}`) ?? [])];
    const from = entryNames(o.entrypoints);
    return `${verb} ${entity}${written.length ? ` (${written.join(", ")})` : ""}${fn ? ` dans ${fn}` : ""}${from.length ? `, depuis ${from.join(", ")}` : ""}`;
  };

  const walkFlow = (dist: number, section: string, flow: FlowStep[] | undefined) => {
    for (const s of flow ?? []) {
      const text = stepText(s);
      if (!text) continue;
      const fn = s.kind === "write" && s.target?.entity ? index.functionAt(s.proof)?.name : undefined;
      const literal = fn ? [...new Set(values.get(`${s.target!.entity}|${fn}`) ?? [])] : [];
      add(dist, section, s.proof, `${"  ".repeat(s.depth)}${text}${literal.length ? ` (${literal.join(", ")})` : ""}`);
      keepFn(s.proof);
      if (dist === 0 && s.target?.entity && (s.kind === "write" || s.kind === "read")) touched.add(s.target.entity);
      if (s.kind === "write" && s.target?.entity) written.add(s.target.entity);
      if (s.kind === "read" && s.target?.entity) read.add(s.target.entity);
      if (s.kind === "message" && s.target?.topic) sent.add(s.target.topic);
    }
  };

  const addEntry = (e: IndexedEntry, dist: number) => {
    if (entriesIn.has(e.id)) return;
    entriesIn.add(e.id);
    const name = index.entryName(e);
    add(dist, `Point d'entrée ${name}`, e.proof, `${e.kind} ${e.key} dans ${e.node}${e.handler ? `, code : ${e.handler.name} (${at(e.handler)})` : ""}`);
    if (e.handler) keepFn(e.handler);
    if (e.access) add(dist, `Point d'entrée ${name}`, e.access.proof ?? e.access.by ?? e.proof, `garde : ${guardText(e.access)}${e.access.by ? ` par ${e.access.by.name}` : ""}`);
    else if (e.kind === "http") add(dist, `Point d'entrée ${name}`, e.proof, "garde : aucune trouvée");
    // Les autres gardes du même déployable : ce qu'on emploierait pour protéger davantage cette porte.
    if (e.kind === "http") {
      const others = new Map<string, IndexedEntry[]>();
      for (const o of index.entries) if (o.node === e.node && o.access?.by && o.access.level !== e.access?.level) {
        const k = `${o.access.level}|${at(o.access.by)}`;
        others.set(k, [...(others.get(k) ?? []), o]);
      }
      for (const [, os] of others) {
        const g = os[0]!.access!;
        add(dist + 1, `Autres gardes de ${e.node}`, g.by, `${guardText(g)} par ${g.by!.name}, employée par ${os.map((o) => index.entryName(o)).join(", ")}`);
      }
    }
    for (const by of entryNames(e.calledBy)) add(dist + 1, `Point d'entrée ${name}`, undefined, `déclenché par ${by}`);
    walkFlow(dist, `Déroulé de ${e.handler?.name ?? name}`, e.flow);
  };

  const addFunction = (f: CodeFunction, dist: number) => {
    const own = index.entries.filter((e) => e.handler && at(e.handler) === at(f.proof));
    if (own.length) return own.forEach((e) => addEntry(e, dist));
    fns.set(f.id, f);
    add(dist, `Fonction ${f.name}`, f.proof, `${f.name}, lignes ${f.proof.line} à ${f.end}`);
    for (const c of f.calledFrom ?? []) add(dist + 1, `Fonction ${f.name}`, c.proof, `appelée${c.fn ? ` par ${c.fn}` : ""}`);
    const reaching = index.entries.filter((e) => e.flow?.some((s) => s.kind === "invoke" && s.name === f.name) && e.files?.includes(f.proof.path));
    for (const e of reaching) add(dist + 1, `Fonction ${f.name}`, e.proof, `exécutée par ${index.entryName(e)} (${e.node})`);
    walkFlow(dist, `Déroulé de ${f.name}`, f.flow);
  };

  const addEntity = (t: IndexedEntity, dist: number) => {
    startEntities.add(t.name);
    touched.add(t.name);
    const section = `Table ${t.node}/${t.name}`;
    if (t.proof) add(dist, section, t.proof, "définition");
    for (const f of t.fields ?? []) if (f.values?.length) add(dist, section, f.proof, `champ ${f.name} : ${f.values.join(", ")}${f.default ? ` (défaut ${f.default})` : ""}`);
    for (const o of index.occurrences("write", { entity: t.name })) add(dist, section, o, occurrenceText("écrit", t.name, o));
    for (const o of index.occurrences("read", { entity: t.name })) add(dist + 1, section, o, occurrenceText("lit", t.name, o));
    for (const tr of t.triggers ?? []) add(dist, section, tr.proof, `déclencheur ${tr.name} sur ${tr.on.join(", ")}`);
  };

  const addTopic = (node: string, name: string, dist: number) => {
    const section = `File ${node}/${name}`;
    for (const o of index.occurrences("message", { topic: name })) add(dist, section, o, occurrenceText("dépose dans", name, o));
    for (const e of index.entries.filter((e) => e.kind === "message" && e.key === name)) addEntry(e, dist + 1);
  };

  const addFinding = (dist: number, f: Start & { kind: "finding" }) => {
    const [first, ...rest] = f.finding.proof;
    add(dist, `Constat ${f.finding.code}`, first, f.finding.message);
    for (const p of rest) add(dist, `Constat ${f.finding.code}`, p, "preuve");
    for (const p of f.finding.proof) {
      const fn = index.functionAt(p);
      if (fn) addFunction(fn, dist + 1);
      const declared = index.entries.find((e) => at(e.proof) === at(p));
      if (declared) addEntry(declared, dist + 1);
    }
  };

  for (const h of handles) {
    const starts = resolve(index, h);
    if (!starts.length) unknown.push(h);
    for (const s of starts) {
      if (s.kind === "entry") addEntry(s.entry, 0);
      else if (s.kind === "function") addFunction(s.fn, 0);
      else if (s.kind === "entity") addEntity(s.entity, 0);
      else if (s.kind === "topic") addTopic(s.node, s.name, 0);
      else addFinding(0, s);
    }
  }

  // Ce que la tranche écrit : qui d'autre l'écrit, puis qui le lit. Une adresse déjà dans la tranche n'est pas redite.
  const listed = new Set(items.map((i) => i.at));
  const fresh = (o: Occurrence) => !listed.has(at(o));
  for (const name of written) {
    if (startEntities.has(name)) continue;
    for (const o of index.occurrences("write", { entity: name }).filter(fresh)) add(1, `Autres écrivains de ${name}`, o, occurrenceText("écrit", name, o));
    for (const o of index.occurrences("read", { entity: name }).filter(fresh)) add(2, `Lecteurs de ${name}`, o, occurrenceText("lit", name, o));
  }
  // Ce qu'elle lit sans l'écrire : qui le change.
  for (const name of read) {
    if (written.has(name) || startEntities.has(name)) continue;
    for (const o of index.occurrences("write", { entity: name })) add(2, `Qui écrit ${name} (lu ici)`, o, occurrenceText("écrit", name, o));
  }
  for (const topic of sent) for (const e of index.entries.filter((e) => e.kind === "message" && e.key === topic)) addEntry(e, 1);

  // Constats et déclarations qui touchent une fonction de la tranche.
  // Un constat sur une fonction rencontrée plus loin (un autre lecteur) compte moins que sur le chemin du départ.
  const within = (f: CodeFunction, p: { path: string; line: number }) => f.proof.path === p.path && f.proof.line <= p.line && p.line <= f.end;
  const far = new Map<string, CodeFunction>();
  for (const i of items.filter((i) => i.dist <= 1)) {
    const [path, line] = [i.at.slice(0, i.at.lastIndexOf(":")), Number(i.at.slice(i.at.lastIndexOf(":") + 1))];
    const f = i.at ? index.functionAt({ path, line }) : undefined;
    if (f && !fns.has(f.id)) far.set(f.id, f);
  }
  const near = (p: { path: string; line: number }) => [...fns.values()].some((f) => within(f, p)) || items.some((i) => i.dist === 0 && i.at === at(p));
  // Les définitions des données touchées : un constat qui porte sur elles (une valeur jamais écrite) concerne la tranche.
  const definitions = new Set(index.entities.filter((t) => touched.has(t.name)).flatMap((t) => [t.proof, ...(t.fields ?? []).map((f) => f.proof)]).flatMap((p) => (p ? [at(p)] : [])));
  // Un constat qui porte sur un autre point d'entrée (sa première preuve est sa déclaration) appartient à sa tranche, pas à celle-ci.
  const declaredAt = new Map(index.entries.map((e) => [at(e.proof), e.id]));
  for (const f of index.model.findings) {
    const about = f.proof.flatMap((p) => declaredAt.get(at(p)) ?? []);
    if (about.length && !about.some((id) => entriesIn.has(id) || related.has(id))) continue;
    const isFar = (p: { path: string; line: number }) => [...far.values()].some((g) => within(g, p));
    const shown = f.proof.find((p) => entriesIn.has(declaredAt.get(at(p)) ?? "")) ?? f.proof.find((p) => related.has(declaredAt.get(at(p)) ?? "")) ?? f.proof.find(near) ?? f.proof[0];
    // Un constat sur le chemin du départ passe avant tout le reste : c'est ce que la coupe doit garder en dernier.
    const dist = f.proof.some(near) ? 0 : f.proof.some((p) => definitions.has(at(p))) ? 1 : f.proof.some(isFar) ? 2 : undefined;
    const also = f.proof.filter((p) => p !== shown).slice(0, 5).map(at);
    if (dist !== undefined) add(dist, "Constats", shown, `${f.code} : ${f.message}${also.length ? ` (aussi : ${also.join(", ")})` : ""}`);
  }
  const entryKeys = new Set([...entriesIn].map((id) => index.entryById(id)?.key));
  for (const c of opts.knowledge?.concepts ?? []) for (const k of c.claims) {
    const anchor = k.anchors.find((a) => a.at && [...fns.values()].some((f) => f.proof.path === a.at!.path && a.at!.line <= f.end && f.proof.line <= a.at!.endLine));
    if (!anchor && !c.entries.some((e) => entryKeys.has(e.name))) continue;
    add(1, "Déclaré par les agents", anchor?.at, `[${k.state}] ${k.type} : ${k.text} (${c.name})`);
  }

  const paths = new Set(items.map((i) => i.at.split(":")[0]));
  for (const g of index.model.coverage.flatMap((c) => c.gaps)) {
    const where: Proof[] = g.where ?? (g.proof ? [g.proof] : []);
    for (const p of where.filter((p) => paths.has(p.path))) add(1, "Non lu dans cette zone", p, `${g.kind} ${g.subject}`);
  }

  // Aucune coupe : les règles de parcours bornent la tranche (distance 2 au plus), on ne fait que ranger du plus proche au plus lointain.
  const order = items.map((item, i) => ({ item, i })).sort((a, b) => a.item.dist - b.item.dist || a.i - b.i);
  return { items: order.map((o) => o.item), unknown };
}

/** La tranche en texte : groupée par section, dans l'ordre où le parcours les a rencontrées. */
export function formatSlice(slice: Slice, handles: string[]): string {
  const out: string[] = [`TRANCHE ${handles.join(", ")}`, "Lis ces lignes avant de modifier : rien ici ne remplace le code.", ""];
  if (slice.unknown.length) out.push(`Introuvable sur la carte : ${slice.unknown.join(", ")}. Reprends un nom du sommaire.`, "");
  return [...out, ...formatSections(slice)].join("\n").trimEnd();
}

/** Les lignes d'une tranche, groupées par section. */
export function formatSections(slice: Slice): string[] {
  const out: string[] = [];
  const sections = [...new Set(slice.items.map((i) => i.section))];
  for (const s of sections) {
    out.push(s);
    for (const i of slice.items.filter((i) => i.section === s)) out.push(`  ${i.at}  ${i.text}`);
    out.push("");
  }
  return out;
}

