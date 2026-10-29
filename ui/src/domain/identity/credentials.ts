import type { ArchModelV2, Proof } from "../../api/types";
import type { EntryRef } from "../features/list";
import type { GuardFn } from "./guards";

/** Une écriture de ce que la garde lit : le point d'entrée qui l'atteint, la ligne, et la fonction qui la contient. */
export interface CredentialWrite {
  item: EntryRef;
  proof: Proof;
  fn?: string;
}

/** Ce que la garde lit pour reconnaître l'appelant (une table, une collection), et qui l'écrit. */
export interface CredentialStore {
  node: string;
  entity: string;
  readBy: GuardFn[];
  writes: CredentialWrite[];
}

const fnAt = (model: ArchModelV2, p: Proof) => {
  for (const n of model.nodes) {
    const f = n.facets.functions?.find((x) => x.proof.path === p.path && x.proof.line <= p.line && p.line <= x.end);
    if (f) return f.name;
  }
  return undefined;
};

/** Les entités lues par une garde, avec chaque point d'entrée qui les écrit : le cycle de vie de la preuve d'identité. */
export function credentialStores(model: ArchModelV2, guards: GuardFn[]): CredentialStore[] {
  const stores = new Map<string, CredentialStore>();
  for (const g of guards) for (const r of g.reads) {
    const k = `${r.node}\0${r.entity}`;
    const s = stores.get(k) ?? stores.set(k, { ...r, readBy: [], writes: [] }).get(k)!;
    if (!s.readBy.includes(g)) s.readBy.push(g);
  }
  for (const node of model.nodes) for (const entry of node.facets.entrypoints ?? []) {
    for (const s of stores.values()) {
      const step = (entry.flow ?? []).find((x) => x.kind === "write" && x.target?.node === s.node && x.target.entity === s.entity);
      if (step) s.writes.push({ item: { entry, node }, proof: step.proof, fn: fnAt(model, step.proof) });
    }
  }
  const open = (s: CredentialStore) => s.writes.filter((w) => w.item.entry.access?.level === "public").length;
  return [...stores.values()].sort((a, b) => open(b) - open(a) || a.entity.localeCompare(b.entity));
}

/**
 * Les points d'entrée ouverts à tous qui écrivent ce qu'une garde lit : là où
 * l'on obtient sa preuve d'identité. Celui qui refuse en 401 vient d'abord :
 * il vérifie quelque chose avant d'ouvrir.
 */
export function openers(stores: CredentialStore[]): EntryRef[] {
  const items = new Map<string, EntryRef>();
  for (const s of stores) for (const w of s.writes) if (w.item.entry.access?.level === "public") items.set(w.item.entry.id, w.item);
  const checks = (e: EntryRef) => (e.entry.flow ?? []).some((s) => s.kind === "refuse" && s.status === "401");
  return [...items.values()].sort((a, b) => Number(checks(b)) - Number(checks(a)) || a.entry.key.localeCompare(b.entry.key));
}
