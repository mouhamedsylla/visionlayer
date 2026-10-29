import type { ArchModelV2, FlowStep, Proof } from "../../api/types";
import { cronLabel } from "../text/cron";
import { sentence } from "../text/sentence";
import type { EntryRef } from "./list";

/** Un couloir du tracé : qui déclenche, le code du point d'entrée, puis chaque bloc qu'il touche. */
export interface Lane {
  id: string;
  title: string;
  sub: string;
}

export const CALLER = "caller";

/** Les couloirs, dans l'ordre où le déroulé touche chaque bloc pour la première fois. */
export function traceLanes({ entry, node }: EntryRef, model: ArchModelV2, names: Map<string, string>): Lane[] {
  const callers = [...new Set([...(entry.calledBy ?? []), ...model.edges.filter((e) => e.target?.entrypoint === entry.id).map((e) => e.from)])];
  const caller: Lane = entry.kind === "schedule" ? { id: CALLER, title: "Horloge", sub: cronLabel(entry.key) }
    : entry.kind === "message" ? { id: CALLER, title: "Message", sub: `file ${entry.key}` }
    : { id: CALLER, title: callers.length ? callers.map((c) => names.get(c) ?? c).join(", ") : "Appelant", sub: callers.length ? "appelant" : "aucun appel lu" };
  const lanes: Lane[] = [caller, { id: node.id, title: entry.handler?.name ?? entry.key, sub: node.name }];
  for (const s of entry.flow ?? []) {
    if (!s.target || lanes.some((l) => l.id === s.target!.node)) continue;
    const touched = [...new Set((entry.flow ?? []).filter((x) => x.target?.node === s.target!.node).map((x) => x.target!.entity ?? x.target!.topic).filter(Boolean))];
    lanes.push({ id: s.target.node, title: names.get(s.target.node) ?? s.target.node, sub: touched.join(", ") });
  }
  return lanes;
}

/** La nature d'une flèche : un appel, une donnée lue ou écrite, ou un retour vers l'appelant. */
export type Arrow = "call" | "data" | "back" | "none";

export interface StepView {
  title: string;
  /** La condition qui mène à l'étape, telle qu'écrite. */
  when?: string;
  from: string;
  to: string;
  arrow: Arrow;
}

/** Une étape dite en mots tirés de ses faits, jamais résumée : `Lit bookings`, `Refuse 409 · not_pending`, `Appelle Stripe · paymentIntents.create`. */
export function stepView(s: FlowStep, owner: string, names: Map<string, string>): StepView {
  const target = s.target ? names.get(s.target.node) ?? s.target.node : "";
  const to = s.target?.node ?? owner;
  const when = s.onError ? "si l'appel juste au-dessus échoue" : s.when ? `si ${s.when}` : undefined;
  const base = { from: owner, when };
  switch (s.kind) {
    case "read": return { ...base, title: `Lit ${s.target?.entity ?? target}`, to, arrow: "data" };
    case "write": return { ...base, title: `Écrit ${s.target?.entity ?? target}`, to, arrow: "data" };
    case "message": return { ...base, title: `Met en file « ${s.target?.topic ?? target} »`, to, arrow: "data" };
    case "request": case "call": return { ...base, title: `Appelle ${target}${s.name ? ` · ${s.name}` : ""}`, to, arrow: "call" };
    case "trigger": return { ...base, title: `Déclenche ${target}`, to, arrow: "call" };
    case "use": case "deploy": return { ...base, title: `Utilise ${target}`, to, arrow: "data" };
    case "invoke": return { ...base, title: `Exécute ${s.name}()`, to: owner, arrow: "none" };
    case "refuse": return {
      ...base, to: CALLER, arrow: "back",
      title: s.status ? `Refuse ${s.status}${s.code ? ` · ${s.code}` : ""}` : `Lève ${s.name ?? "une erreur"}${s.code ? ` · ${s.code}` : ""}`,
    };
    case "return": return { ...base, title: "S'arrête avant la fin", to: CALLER, arrow: "back" };
    case "reply": return { ...base, title: `Répond${s.status ? ` ${s.status}` : ""}${s.when ? " avant la fin" : ""}`, to: CALLER, arrow: "back" };
  }
}

/** Ce qui se passe quand une étape rate : les refus sur erreur, et les constats posés sur les lignes du déroulé. */
export interface Failure {
  text: string;
  type: string;
  proof?: Proof;
}

const TYPE: Partial<Record<string, string>> = {
  write_then_enqueue: "message perdu", missing_timeout: "panne", race_read_then_write: "courses", personal_data_logged: "données perso",
  unguarded_route: "accès", scheduled_on_every_instance: "planifié", order_assumption: "ordre",
};

export function traceFailures({ entry, node }: EntryRef, model: ArchModelV2): Failure[] {
  const steps = entry.flow ?? [];
  // L'étendue du déroulé dans chaque fichier : un constat peut viser une ligne au milieu d'une instruction.
  const extent = new Map<string, [number, number]>();
  for (const st of steps) {
    const [a, b] = extent.get(st.proof.path) ?? [st.proof.line, st.proof.line];
    extent.set(st.proof.path, [Math.min(a, st.proof.line), Math.max(b, st.proof.line)]);
  }
  const within = (p: Proof) => { const e = extent.get(p.path); return !!e && p.line >= e[0] && p.line <= e[1]; };
  const out: Failure[] = steps.filter((s) => s.onError).map((s) => ({
    text: `L'appel juste avant échoue : ${s.status ? `refus ${s.status}${s.code ? ` ${s.code}` : ""}` : "erreur levée"}.${s.why ? ` « ${s.why.text} »` : ""}`,
    type: "erreur", proof: s.proof,
  }));
  for (const f of model.findings) {
    const type = TYPE[f.code];
    if (!type) continue;
    // Une connexion sans délai maximum compte pour tout déroulé qui touche ce bloc ; une tâche lancée sur chaque exemplaire,
    // pour les tâches planifiées de son bloc ; un autre constat, quand sa ligne principale est dans le déroulé.
    const hit = f.code === "missing_timeout" ? (steps.some((s) => s.target && (f.nodes ?? []).includes(s.target.node)) ? f.proof[0] : undefined)
      : f.code === "scheduled_on_every_instance" ? (entry.kind === "schedule" && (f.nodes ?? []).includes(node.id) ? f.proof[0] : undefined)
      : f.proof.slice(0, 1).find(within);
    if (hit) out.push({ text: `${sentence(f.message)}.`, type, proof: hit });
  }
  return out;
}
