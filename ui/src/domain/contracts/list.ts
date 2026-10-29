import type { ArchModelV2, ArchNode, ContractFacet, Proof } from "../../api/types";
import type { EntryRef } from "../features/list";
import { findEntry } from "../features/list";
import { producersOf } from "../messages/triggers";

/** Un contrat et le composant qui le porte ; `id` est son adresse dans l'écran. */
export interface ContractRef {
  id: string;
  node: ArchNode;
  contract: ContractFacet;
}

/** Tous les contrats de la carte : une interface du dépôt implémentée au moins deux fois. */
export function contractsOf(model: ArchModelV2): ContractRef[] {
  return model.nodes.flatMap((node) => {
    const list = node.facets.contract ?? [];
    return list.map((contract) => ({ id: list.length > 1 ? `${node.id}:${contract.name}` : node.id, node, contract }));
  });
}

export function findContract(model: ArchModelV2, id: string | undefined): ContractRef | undefined {
  const all = contractsOf(model);
  return all.find((c) => c.id === id) ?? (id ? undefined : all[0]);
}

/** Les points d'entrée dont le code appelle la fonction qui choisit l'implémentation. */
export function callersOf({ contract }: ContractRef, model: ArchModelV2): { item: EntryRef; proof: Proof }[] {
  const name = contract.selector?.symbol.name;
  if (!name) return [];
  return model.nodes.flatMap((node) => (node.facets.entrypoints ?? []).flatMap((entry) => {
    const step = (entry.flow ?? []).find((s) => s.kind === "invoke" && s.name === name);
    return step ? [{ item: { entry, node }, proof: step.proof }] : [];
  }));
}

/** Ce qui finit par employer le contrat : qui l'appelle, et qui met un job dans la file de cet appelant. */
export interface ContractUser {
  item: EntryRef;
  how: string;
  proof: Proof;
}

export function usersOf(ref: ContractRef, model: ArchModelV2): ContractUser[] {
  const out: ContractUser[] = [];
  for (const c of callersOf(ref, model)) {
    out.push({ item: c.item, how: `appelle ${ref.contract.selector!.symbol.name}()`, proof: c.proof });
    for (const p of producersOf(c.item.entry, model)) for (const id of p.entrypoints) {
      const item = findEntry(model, id);
      if (item && !out.some((u) => u.item.entry.id === id)) out.push({ item, how: `met un job dans « ${c.item.entry.key} »`, proof: p.proof });
    }
  }
  return out;
}

/** Les variables lues par la fonction qui choisit, noms seulement, avec l'endroit où elles sont lues et si le code les exige. */
export function selectorEnv({ node, contract }: ContractRef, model: ArchModelV2): { name: string; required?: boolean; at: Proof[] }[] {
  const names = contract.selector?.config ?? [];
  const parent = model.nodes.find((n) => n.id === node.parent);
  const env = [...(parent?.facets.config?.env ?? []), ...model.nodes.flatMap((n) => n.facets.config?.env ?? [])];
  return names.map((name) => {
    const found = env.filter((e) => e.name === name);
    const at = [...new Map(found.flatMap((e) => e.readAt).map((p) => [`${p.path}:${p.line}`, p])).values()];
    const required = found.find((e) => e.required !== undefined)?.required;
    return { name, ...(required !== undefined ? { required } : {}), at };
  });
}

/** `smtp → SmtpSender · console → ConsoleSender · sinon ResendSender`. */
export function choicesLabel(contract: ContractFacet): string {
  const choices = contract.selector?.choices ?? [];
  const named = choices.filter((c) => c.when).map((c) => `${c.when} → ${c.implementation}`);
  const rest = choices.find((c) => !c.when);
  return [...named, ...(rest ? [`${named.length ? "sinon " : ""}${rest.implementation}`] : [])].join(" · ");
}
