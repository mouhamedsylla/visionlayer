import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { FactBase } from "./base.js";
import { loadPackText, producedRelations, relationArities, type Pack } from "./packs.js";
import type { Database } from "./datalog.js";
import { assemble } from "./assemble.js";
import { mapChanges } from "../web/changes.js";
import type { MapChange } from "../web/types.js";

/**
 * Les packs locaux d'un projet, chargés et retirés à chaud (ADR 0019).
 *
 * Un pack local vit dans `.vision/packs/<id>.yaml`. Il est écrit par un humain ou par un agent, et n'a droit
 * qu'à des requêtes et des règles. À chaque `sync`, le registre relit le dossier ; pour chaque pack nouveau
 * ou modifié, il vérifie dans l'ordre :
 *   1. le schéma, et l'absence de script ;
 *   2. ce qu'il produit : seulement ce qu'il déclare dans `provides`, avec l'arité des relations existantes ;
 *   3. aucun cycle avec un autre pack local (l'un lit ce que l'autre produit, et inversement) ;
 *   4. ses tests, dans un dossier à part, avec les packs livrés ;
 *   5. son chargement, sur une copie de la base de faits : la copie n'est adoptée que si tout passe.
 * Un pack qui échoue reste en `failed` avec son erreur, et la version d'avant (ou rien) reste en place :
 * la carte n'est jamais à moitié rechargée. Un pack dont une relation de `requires` manque reste
 * `inactive`, sans erreur, et s'allume quand elle apparaît.
 */
export type PackStatus = "active" | "inactive" | "failed";

export interface PackState {
  id: string;
  file: string;
  status: PackStatus;
  /** Pour `failed` : pourquoi. Pour `inactive` : la relation qui manque. */
  reason?: string;
  /** Les relations qu'il produit. */
  provides: string[];
}

interface Entry { file: string; hash: string; pack?: Pack; state: PackState }

export class PackRegistry {
  private readonly entries = new Map<string, Entry>();
  /** La dernière version qui a passé toutes les vérifications, par fichier : elle reste en place quand la suivante échoue. */
  private readonly good = new Map<string, Pack>();

  constructor(readonly root: string, readonly builtins: Pack[]) {}

  get dir(): string { return join(this.root, ".vision", "packs"); }

  states(): PackState[] { return [...this.entries.values()].map((e) => e.state).sort((a, b) => a.id.localeCompare(b.id)); }

  /**
   * Relit `.vision/packs/` et applique ce qui a changé. Rend la base de faits à employer : la même si rien
   * n'a changé ou si le changement a échoué, une nouvelle sinon.
   */
  async sync(base: FactBase): Promise<FactBase> {
    const files = existsSync(this.dir) ? readdirSync(this.dir).filter((f) => f.endsWith(".yaml")).sort() : [];
    const seen = new Set<string>();
    for (const f of files) {
      const file = join(this.dir, f);
      seen.add(file);
      const text = readFileSync(file, "utf8");
      const hash = createHash("sha1").update(text).digest("hex");
      if (this.entries.get(file)?.hash === hash) continue;
      this.entries.set(file, await this.check(file, text, hash));
    }
    for (const file of [...this.entries.keys()]) if (!seen.has(file)) { this.entries.delete(file); this.good.delete(file); }

    // Les packs à charger : la dernière bonne version de chaque fichier, allumée si ce qu'elle lit existe.
    const known = new Set([...relationsOf(base.database()), ...this.builtins.flatMap(producedRelations)]);
    const candidates = [...this.good.entries()];
    let active: [string, Pack][] = [];
    for (let changed = true; changed;) {
      changed = false;
      for (const [file, pack] of candidates) {
        if (active.some(([f]) => f === file)) continue;
        const missing = (pack.requires ?? []).find((r) => !known.has(r) && !active.some(([, p]) => producedRelations(p).includes(r)));
        const entry = this.entries.get(file)!;
        if (missing) { if (entry.state.status !== "failed") entry.state = { ...entry.state, status: "inactive", reason: `${missing} n'est produite par aucun pack actif` }; continue; }
        active.push([file, pack]);
        if (entry.state.status !== "failed") entry.state = { ...entry.state, status: "active", reason: undefined };
        changed = true;
      }
    }

    const next = [...this.builtins, ...active.map(([, p]) => p)];
    if (sameSet(next, base.packs)) return base;
    // La transaction : tout se fait sur une copie, adoptée seulement si les règles tournent jusqu'au bout.
    const trial = base.clone();
    try {
      trial.setPacks(next);
      trial.database();
      return trial;
    } catch (e) {
      const message = (e as Error).message.split("\n")[0]!;
      for (const [file, pack] of active) if (!base.packs.some((p) => p.id === pack.id && p.hash === pack.hash)) {
        this.good.delete(file);
        this.entries.get(file)!.state = { ...this.entries.get(file)!.state, status: "failed", reason: `chargement : ${message}` };
      }
      return base;
    }
  }

  /**
   * Un pack proposé, essayé dans un domaine à part (ADR 0019) : les vérifications 1 à 4, puis la carte
   * « acceptée + proposé » calculée sur une copie de la base. Rend ce qu'il ajouterait ou retirerait ;
   * la carte acceptée n'est pas touchée, et rien n'est écrit.
   */
  async preview(base: FactBase, text: string, name = "propose.yaml"): Promise<{ state: PackState; changes: MapChange[] }> {
    const entry = await this.check(join(this.dir, "proposes", name), text, "preview", false);
    if (!entry.pack) return { state: entry.state, changes: [] };
    const trial = base.clone();
    try {
      trial.setPacks([...base.packs.filter((p) => p.id !== entry.pack!.id), entry.pack]);
      const label = { name: "preview", packs: [] as Pack[] };
      const before = assemble(base.database(), { ...label, packs: [...base.packs] });
      const after = assemble(trial.database(), { ...label, packs: [...trial.packs] });
      return { state: entry.state, changes: mapChanges(before, after) };
    } catch (e) {
      return { state: { ...entry.state, status: "failed", reason: `chargement : ${(e as Error).message.split("\n")[0]}` }, changes: [] };
    }
  }

  /** Les vérifications 1 à 4, sans toucher la carte. */
  private async check(file: string, text: string, hash: string, keep = true): Promise<Entry> {
    const fail = (id: string, reason: string, provides: string[] = []): Entry => ({ file, hash, state: { id, file, status: "failed", reason, provides } });
    let pack: Pack;
    try {
      pack = await loadPackText(text, file, { allowScript: false });
    } catch (e) {
      return fail(file.split("/").pop()!.replace(/\.yaml$/, ""), (e as Error).message);
    }
    const produced = producedRelations(pack);
    if (this.builtins.some((b) => b.id === pack.id)) return fail(pack.id, `l'identifiant ${pack.id} est celui d'un pack livré`, produced);
    if (!pack.provides?.length) return fail(pack.id, "un pack local doit déclarer ce qu'il produit (provides)", produced);
    const undeclared = produced.filter((r) => !pack.provides!.includes(r));
    if (undeclared.length) return fail(pack.id, `produit sans le déclarer : ${undeclared.join(", ")}`, produced);

    // L'arité d'une relation partagée doit être celle que les autres packs emploient : sinon, même nom, autre sens.
    const others = [...this.builtins, ...[...this.good.entries()].filter(([f]) => f !== file).map(([, p]) => p)];
    for (const [rel, n] of relationArities(pack)) {
      const other = others.map((o) => [o.id, relationArities(o).get(rel)] as const).find(([, m]) => m !== undefined && m !== n);
      if (other) return fail(pack.id, `${rel} a ${n} arguments ici, ${other[1]} dans le pack ${other[0]}`, produced);
    }
    for (const [, o] of this.good.entries()) {
      if (o.id === pack.id) continue;
      const a = (pack.requires ?? []).filter((r) => producedRelations(o).includes(r));
      const b = (o.requires ?? []).filter((r) => produced.includes(r));
      if (a.length && b.length) return fail(pack.id, `cycle avec le pack ${o.id} : ${pack.id} lit ${a.join(", ")}, ${o.id} lit ${b.join(", ")}`, produced);
    }

    const broken = await runPackTests(pack, this.builtins);
    if (broken) return fail(pack.id, broken, produced);

    if (keep) this.good.set(file, pack);
    return { file, hash, pack, state: { id: pack.id, file, status: "active", provides: produced } };
  }
}

/** Les tests déclarés par un pack, chacun dans un dossier à part avec les packs livrés. Rend la première erreur, ou rien. */
export async function runPackTests(pack: Pack, builtins: Pack[]): Promise<string | undefined> {
  if (!pack.tests?.length) return "un pack local doit apporter ses tests (tests), au moins un par forme";
  for (const t of pack.tests) {
    const dir = mkdtempSync(join(tmpdir(), `vision-pack-test-${pack.id}-`));
    try {
      for (const [p, content] of Object.entries(t.files)) {
        mkdirSync(dirname(join(dir, p)), { recursive: true });
        writeFileSync(join(dir, p), content);
      }
      const base = new FactBase(dir, [...builtins, pack]);
      base.refresh();
      const db = base.database();
      for (const e of t.expect) if (!matches(db, e)) return `test « ${t.name} » : ${e} attendu, absent`;
      for (const e of t.absent) if (matches(db, e)) return `test « ${t.name} » : ${e} ne devait pas sortir`;
      const failed = db.get("pack_failed").find((f) => String(f.args[0]) === pack.id);
      if (failed) return `test « ${t.name} » : le pack a échoué sur ${String(failed.args[1])} : ${String(failed.args[2])}`;
    } catch (e) {
      return `test « ${t.name} » : ${(e as Error).message.split("\n")[0]}`;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  return undefined;
}

/** `rel(a, "b c", _)` : un fait de la base qui correspond, `_` valant n'importe quoi. */
function matches(db: Database, pattern: string): boolean {
  const m = pattern.trim().match(/^([a-z_][a-z0-9_]*)\((.*)\)$/s);
  if (!m) throw new Error(`motif illisible « ${pattern} »`);
  const want = splitTop(m[2]!).map((a) => a.trim().replace(/^"(.*)"$/s, "$1"));
  return db.get(m[1]!).some((t) => t.args.length === want.length && want.every((w, i) => w === "_" || String(t.args[i]) === w));
}

function splitTop(s: string): string[] {
  const out: string[] = [];
  let cur = "", quote = false;
  for (const c of s) {
    if (c === '"') quote = !quote;
    if (c === "," && !quote) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

const relationsOf = (db: Database) => db.relations();
const sameSet = (a: readonly Pack[], b: readonly Pack[]) => a.length === b.length && a.every((p) => b.some((q) => q.id === p.id && q.hash === p.hash));
