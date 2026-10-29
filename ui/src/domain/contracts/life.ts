import type { ArchModelV2, FlowStep, Proof } from "../../api/types";
import { CALLER, stepView, traceLanes, type Lane, type StepView } from "../features/trace";
import type { EntryRef } from "../features/list";
import { producersOf } from "../messages/triggers";
import { callersOf, choicesLabel, type ContractRef } from "./list";

export const PRODUCER = "producer";
export const ADAPTER = "adapter";
export const NATIVE = "native";

export interface LifeStep {
  step: FlowStep;
  view: StepView;
}

const synth = (kind: FlowStep["kind"], proof: Proof, why?: FlowStep["why"]): FlowStep => ({ kind, depth: 0, proof, ...(why ? { why } : {}) });

/**
 * La vie d'un appel au contrat, de la feature au fournisseur et retour,
 * en couloirs : qui met en file (s'il y a une file), qui appelle, la fonction
 * qui choisit l'adaptateur, l'appel natif, la réponse redevenue neutre, puis
 * ce que fait l'appelant ensuite. Chaque étape est une ligne du code.
 */
export function contractLife(ref: ContractRef, model: ArchModelV2, names: Map<string, string>): { item?: EntryRef; lanes: Lane[]; steps: LifeStep[] } {
  const { contract } = ref;
  const caller = callersOf(ref, model)[0];
  if (!caller) return { lanes: [], steps: [] };
  const { item, proof: at } = caller;
  const owner = item.node.id;
  const handler = item.entry.handler?.name ?? item.entry.key;
  const steps: LifeStep[] = [];
  const base = traceLanes(item, model, names);
  const lanes: Lane[] = [];

  const producers = producersOf(item.entry, model);
  if (producers.length) {
    // la ligne que son auteur a commentée, sinon la première
    const all = model.nodes.flatMap((n) => n.facets.entrypoints ?? []);
    const whyOf = (p: (typeof producers)[number]) => all.filter((e) => p.entrypoints.includes(e.id))
      .flatMap((e) => e.flow ?? []).find((s) => s.kind === "message" && s.proof.path === p.proof.path && s.proof.line === p.proof.line)?.why;
    const first = producers.find((p) => whyOf(p)) ?? producers[0]!;
    const why = whyOf(first);
    const fnOf = (id: string) => all.find((e) => e.id === id)?.handler?.name ?? id;
    const fns = [...new Set([...first.entrypoints, ...producers.flatMap((p) => p.entrypoints)].map(fnOf))];
    lanes.push({ id: PRODUCER, title: fns[0] ?? "une feature", sub: fns.length > 1 ? `et ${fns.length - 1} autres` : "une feature" });
    steps.push({ step: synth("message", first.proof, why), view: { title: `Met un job dans « ${item.entry.key} »`, from: PRODUCER, to: CALLER, arrow: "data" } });
    const settings = model.nodes.flatMap((n) => n.facets.channel?.topics ?? []).find((t) => t.name === item.entry.key)?.settings ?? [];
    const conc = settings.find((s) => /concurrency/i.test(s.key));
    steps.push({ step: synth("trigger", item.entry.proof), view: { title: `${handler} prend le job${conc ? `, ${conc.value} à la fois au plus` : ""}`, from: CALLER, to: owner, arrow: "call" } });
  }
  lanes.push(...base.slice(0, 2));
  const n = contract.implementations.length;
  lanes.push({ id: ADAPTER, title: "Adaptateur", sub: contract.selector?.symbol.name ?? contract.name }, { id: NATIVE, title: "Fournisseur", sub: `${n} implémentation${n > 1 ? "s" : ""}` });

  const choices = choicesLabel(contract);
  steps.push({ step: synth("invoke", at), view: { title: `Obtient l'adaptateur : ${contract.selector!.symbol.name}()`, ...(choices ? { when: choices } : {}), from: owner, to: ADAPTER, arrow: "call" } });

  // l'implémentation retenue quand rien n'est réglé, sinon la première
  const fallback = contract.selector?.choices?.find((c) => !c.when)?.implementation;
  const impl = contract.implementations.find((i) => i.name === fallback) ?? contract.implementations[0]!;
  const op = contract.operations.find((o) => o.request || o.result) ?? contract.operations[0];
  const call = impl.calls?.[0];
  if (call) {
    const others = contract.implementations.filter((i) => i !== impl && i.calls?.length).map((i) => `${i.calls![0]!.name} (${i.name})`);
    steps.push({ step: synth("call", call.proof), view: { title: `${impl.name} traduit en appel natif · ${call.name}`, ...(others.length ? { when: `ailleurs : ${others.join(", ")}` } : {}), from: ADAPTER, to: NATIVE, arrow: "call" } });
  }
  const ret = impl.returns?.[impl.returns.length - 1];
  if (ret && op?.result) {
    steps.push({ step: synth("return", ret), view: { title: `La réponse redevient un ${op.result.name}`, when: op.result.fields.slice(0, 3).map((f) => f.name).join(", "), from: NATIVE, to: owner, arrow: "back" } });
  }

  // la suite du code de l'appelant, après la ligne qui appelle le contrat
  for (const s of item.entry.flow ?? []) {
    if (s.depth !== 0 || s.proof.path !== at.path || s.proof.line <= at.line) continue;
    if (s.target && !lanes.some((l) => l.id === s.target!.node)) lanes.push({ id: s.target.node, title: names.get(s.target.node) ?? s.target.node, sub: s.target.entity ?? s.target.topic ?? "" });
    steps.push({ step: s, view: stepView(s, owner, names) });
  }
  return { item, lanes, steps };
}
