import type { Constraint, Entity, Field, FieldRead, FieldWrite } from "../arch/types.js";
import type { Database, Value } from "./datalog.js";

/**
 * Le détail d'une entité, d'après les relations neutres des packs :
 *
 *   entity_field(Tech, Entité, Champ, Type, null|notnull)        ses champs
 *   entity_value(Tech, Entité, Champ, Valeur)                    les valeurs permises d'un champ
 *   entity_constraint(Tech, Entité, Genre, Nom, Champs, Où)      primary, unique, index, check ; Champs séparés par des virgules
 *   entity_ref(Tech, Entité, Champs, Entité visée)               une clé étrangère
 *   entity_default(Tech, Entité, Champ, Valeur)                  la valeur par défaut posée par la base
 *   entity_write(Tech, Entité, Champ, Valeur|"", Fichier, Ligne) une écriture du champ par le code ; "" quand la valeur est calculée
 *   entity_read(Tech, Entité, Champ|"*", Fichier, Ligne)        une lecture du champ par le code ; "*" quand elle rend la ligne entière
 *   entity_on_delete(Tech, Entité, Champs, Action)               ce que fait la base à la suppression de la ligne visée
 *   entity_comment(Tech, Entité, Champ|"", Texte)                ce que l'auteur dit d'un champ, ou de l'entité ("")
 *   entity_delete(Tech, Entité, "", Fichier, Ligne)             une ligne du code qui supprime des lignes de l'entité
 *   entity_constraint_comment(Tech, Entité, Genre, Champs, Texte) ce que l'auteur dit d'une contrainte
 *   entity_trigger(Entité, Nom, Opérations)                      du code de la base qui s'exécute quand elle change
 *   trigger_writes(Nom, Entité)                                  ce que ce code écrit
 *
 * Un déclencheur lu dans un fichier SQL ne dit pas sa base : il revient à
 * l'entité de ce nom, quel que soit son stockage.
 */
export type EntityDetail = Pick<Entity, "fields" | "constraints" | "triggers" | "comment">;

export function entityDetails(db: Database): (tech: string, entity: string) => EntityDetail {
  const s = (v: Value | undefined) => String(v);
  const key = (tech: string, entity: string) => `${tech}\0${entity}`;
  const list = <T>(m: Map<string, T[]>, k: string) => m.get(k) ?? m.set(k, []).get(k)!;
  const split = (v: Value | undefined) => s(v).split(",").filter(Boolean);

  const values = new Map<string, string[]>();
  for (const t of db.get("entity_value")) list(values, `${key(s(t.args[0]), s(t.args[1]))}\0${s(t.args[2])}`).push(s(t.args[3]));

  const defaults = new Map(db.get("entity_default").map((t) => [`${key(s(t.args[0]), s(t.args[1]))}\0${s(t.args[2])}`, s(t.args[3])]));
  const comments = new Map(db.get("entity_comment").map((t) => [`${key(s(t.args[0]), s(t.args[1]))}\0${s(t.args[2])}`, s(t.args[3])]));
  const consSaid = new Map(db.get("entity_constraint_comment").map((t) => [`${key(s(t.args[0]), s(t.args[1]))}\0${s(t.args[2])}\0${s(t.args[3])}`, s(t.args[4])]));
  const onDelete = new Map(db.get("entity_on_delete").map((t) => [`${key(s(t.args[0]), s(t.args[1]))}\0${s(t.args[2])}`, s(t.args[3])]));
  const writes = fieldWrites(db);
  const deletes = located(db, "entity_delete", 3);
  const reads = fieldReads(db);

  const fields = new Map<string, Field[]>();
  for (const t of db.get("entity_field")) {
    const k = key(s(t.args[0]), s(t.args[1]));
    const name = s(t.args[2]);
    const vals = values.get(`${k}\0${name}`);
    const def = defaults.get(`${k}\0${name}`);
    const comment = comments.get(`${k}\0${name}`);
    const w = writes.get(`${k}\0${name}`);
    const r = [...(reads.get(`${k}\0${name}`) ?? []), ...(reads.get(`${k}\0*`) ?? []).map((x) => ({ ...x, whole: true }))];
    const f: Field = {
      name, type: s(t.args[3]), nullable: s(t.args[4]) === "null", ...(vals ? { values: [...new Set(vals)] } : {}),
      ...(def !== undefined ? { default: def } : {}), ...(comment ? { comment } : {}), ...(w ? { writes: w } : {}), ...(r.length ? { reads: r } : {}), proof: t.proof[0]!,
    };
    const own = list(fields, k);
    if (!own.some((x) => x.name === name)) own.push(f);
  }

  const constraints = new Map<string, Constraint[]>();
  const addConstraint = (k: string, c: Constraint) => {
    const own = list(constraints, k);
    if (!own.some((x) => x.kind === c.kind && x.fields.join() === c.fields.join() && x.name === c.name)) own.push(c);
  };
  for (const t of db.get("entity_constraint")) {
    const [name, where] = [s(t.args[3]), s(t.args[5])];
    const k = key(s(t.args[0]), s(t.args[1]));
    const said = consSaid.get(`${k}\0${s(t.args[2])}\0${s(t.args[4])}`);
    addConstraint(k, {
      kind: s(t.args[2]) as Constraint["kind"], ...(name ? { name } : {}), fields: split(t.args[4]), ...(where ? { where } : {}), ...(said ? { comment: said } : {}), proof: t.proof[0]!,
    });
  }
  for (const t of db.get("entity_ref")) {
    const k = key(s(t.args[0]), s(t.args[1]));
    const action = onDelete.get(`${k}\0${s(t.args[2])}`);
    addConstraint(k, { kind: "foreign", fields: split(t.args[2]), references: s(t.args[3]), ...(action ? { onDelete: action } : {}), proof: t.proof[0]! });
  }

  const trigWrites = new Map<string, string[]>();
  for (const t of db.get("trigger_writes")) list(trigWrites, s(t.args[0])).push(s(t.args[1]));
  const triggers = new Map<string, NonNullable<Entity["triggers"]>>();
  for (const t of db.get("entity_trigger")) {
    const name = s(t.args[1]);
    const w = [...new Set(trigWrites.get(name) ?? [])].sort();
    list(triggers, s(t.args[0])).push({ name, on: split(t.args[2]) as ("insert" | "update" | "delete")[], proof: t.proof[0]!, ...(w.length ? { writes: w } : {}) });
  }

  return (tech, entity) => {
    const k = key(tech, entity);
    const f = fields.get(k), c = constraints.get(k), tr = triggers.get(entity), said = comments.get(`${k}\0`);
    const d = deletes.get(`${k}\0`)?.map(({ proof, fn }) => ({ proof, ...(fn ? { fn } : {}) }));
    return { ...(said ? { comment: said } : {}), ...(f?.length ? { fields: f } : {}), ...(c?.length ? { constraints: c } : {}), ...(tr?.length ? { triggers: tr } : {}), ...(d?.length ? { deletes: d } : {}) };
  };
}

/** Les lectures de chaque champ ("*" : la ligne entière), à leur ligne, avec la fonction de premier niveau qui les contient. */
function fieldReads(db: Database): Map<string, FieldRead[]> {
  const out = new Map<string, FieldRead[]>();
  for (const [k, list] of located(db, "entity_read", 3)) out.set(k, list.map(({ proof, fn }) => ({ ...(fn ? { fn } : {}), proof })));
  return out;
}

/** Les écritures de chaque champ, à leur ligne, avec la fonction de premier niveau qui les contient. */
function fieldWrites(db: Database): Map<string, FieldWrite[]> {
  const out = new Map<string, FieldWrite[]>();
  for (const [k, list] of located(db, "entity_write", 4)) out.set(k, list.map(({ proof, fn, extra }) => ({ ...(extra ? { value: extra } : {}), ...(fn ? { fn } : {}), proof })));
  return out;
}

/**
 * Les faits `(Tech, Entité, Champ, [Valeur,] Fichier, Ligne)` d'une relation, groupés par champ, sans doublon d'adresse,
 * chacun avec la fonction de premier niveau qui contient sa ligne. `at` : la position du fichier dans les arguments.
 */
function located(db: Database, relation: string, at: number): Map<string, { proof: FieldWrite["proof"]; fn?: string; extra?: string }[]> {
  const s = (v: Value | undefined) => String(v);
  const spans = new Map<string, { name: string; from: number; to: number }[]>();
  for (const t of db.get("fn_span")) {
    const file = s(t.args[0]);
    (spans.get(file) ?? spans.set(file, []).get(file)!).push({ name: s(t.args[1]), from: Number(t.args[2]), to: Number(t.args[3]) });
  }
  const out = new Map<string, { proof: FieldWrite["proof"]; fn?: string; extra?: string }[]>();
  for (const t of db.get(relation)) {
    const [tech, entity, field] = t.args.slice(0, 3).map(s) as [string, string, string];
    const extra = at > 3 ? s(t.args[3]) : undefined;
    const path = s(t.args[at]);
    const line = Number(t.args[at + 1]);
    const k = `${tech}\0${entity}\0${field}`;
    const own = out.get(k) ?? out.set(k, []).get(k)!;
    if (own.some((w) => w.proof.path === path && w.proof.line === line)) continue;
    const fn = spans.get(path)?.filter((f) => f.from <= line && line <= f.to).sort((a, b) => b.from - a.from)[0]?.name;
    const proof = t.proof.find((p) => p.path === path && p.line === line) ?? { path, line, source: "pack" as const };
    own.push({ proof, ...(fn ? { fn } : {}), ...(extra ? { extra } : {}) });
  }
  for (const list of out.values()) list.sort((a, b) => a.proof.path.localeCompare(b.proof.path) || a.proof.line - b.proof.line);
  return out;
}
