import type { ArchNode, MapPayload, Proof } from "../api/types";
import { plural } from "./words";

type Contract = NonNullable<ArchNode["facets"]["contract"]>[number];

/** Une ligne de X3 : une implémentation, où le conteneur la branche, ce qui la choisit, et ce qu'elle appelle. */
export interface ImplRow { name: string; proof: Proof; bound: Proof[]; when?: string; calls: string[]; packages: string[] }

/** Un contrat lu : l'interface ou la classe abstraite, ses implémentations, ceux qui le reçoivent. */
export interface ContractView { id: string; node: ArchNode; c: Contract; impls: ImplRow[]; consumers: { name: string; proof: Proof }[]; sentence: string }

export function contracts(map: MapPayload): ContractView[] {
  const out: ContractView[] = [];
  for (const node of map.model.nodes) for (const c of node.facets.contract ?? []) {
    const impls: ImplRow[] = c.implementations.map((i) => {
      const choice = c.selector?.choices?.find((x) => x.implementation === i.name);
      return {
        name: i.name,
        proof: { path: i.path, line: i.line, source: "syntax" },
        bound: (c.bindings ?? []).filter((b) => b.implementation === i.name).map((b) => b.proof),
        ...(choice ? { when: choice.when ?? "sinon" } : {}),
        calls: [...new Set((i.calls ?? []).map((x) => x.name))],
        packages: i.packages ?? [],
      };
    });
    const consumers = c.consumers ?? [];
    out.push({ id: `${node.id}/${c.name}`, node, c, impls, consumers, sentence: sentenceOf(c.name, impls, consumers, c.selector?.config) });
  }
  return out.sort((a, b) => b.consumers.length - a.consumers.length || a.c.name.localeCompare(b.c.name));
}

function sentenceOf(name: string, impls: ImplRow[], consumers: { name: string }[], config?: string[]): string {
  const who = consumers.length ? `${consumers.map((k) => k.name).slice(0, 2).join(" et ")}${consumers.length > 2 ? ` et ${consumers.length - 2} autres` : ""} ${consumers.length > 1 ? "le reçoivent" : "le reçoit"} du conteneur` : "aucune classe ne le reçoit d'un conteneur, d'après ce qui est lu";
  const bound = impls.filter((i) => i.bound.length).length;
  const how = config?.length ? `, choisie selon ${config.join(", ")}` : bound ? `, ${bound === impls.length ? "chacune branchée" : `${bound} branchées`} par le conteneur` : "";
  return `${name} a ${plural(impls.length, "implémentation", "implémentations")}${how} ; ${who}.`;
}
