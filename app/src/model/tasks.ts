import type { ArchNode, Entrypoint, Finding, FlowStep, MapPayload } from "../api/types";
import { sentence } from "./overview";

/**
 * La planche 06 (Tâches planifiées) : ce qui tourne sans que personne clique. Les tâches planifiées, lues
 * dans leur expression cron et multipliées par le nombre de machines du programme qui les lance ; ce qui
 * arrive à la demande (une file, un webhook signé). Les exécutions réelles ne sont pas lues.
 */

export interface Trigger {
  id: string; name: string; when: string; kind: "schedule" | "queue" | "webhook";
  node: ArchNode; entry: Entrypoint; machines: number;
  /** Les heures de la journée (0 à 24) où il part ; `fill` : sans arrêt. */
  ticks: number[]; fill: boolean; perDay?: number;
  does: string; onFail: string; see?: string; seeTone?: "cr" | "q" | "ok"; finding?: Finding;
}

/** Une expression cron en mots, et ses heures dans une journée. */
export function cron(expr: string): { when: string; ticks: number[]; fill: boolean; perDay: number } {
  const [m = "*", h = "*", dom = "*", mon = "*", dow = "*"] = expr.trim().split(/\s+/);
  const some = dom !== "*" || mon !== "*" || dow !== "*" ? ", certains jours" : "";
  const step = (f: string) => (/^\*\/(\d+)$/.test(f) ? Number(f.slice(2)) : undefined);
  if (m === "*" && h === "*") return { when: `every minute${some}`, ticks: [], fill: true, perDay: 1440 };
  if (step(m) && h === "*") return { when: `every ${step(m)} minutes${some}`, ticks: [], fill: true, perDay: Math.floor(1440 / step(m)!) };
  if (/^\d+$/.test(m) && h === "*") return { when: `every hour at ${m} min${some}`, ticks: Array.from({ length: 24 }, (_, i) => i + Number(m) / 60), fill: false, perDay: 24 };
  if (/^\d+$/.test(m) && step(h)) return { when: `every ${step(h)} h${some}`, ticks: Array.from({ length: Math.ceil(24 / step(h)!) }, (_, i) => i * step(h)! + Number(m) / 60), fill: false, perDay: Math.ceil(24 / step(h)!) };
  if (/^\d+$/.test(m) && /^[\d,]+$/.test(h)) {
    const hours = h.split(",").map(Number);
    return { when: `every day at ${hours.map((x) => `${x} h${m !== "0" ? ` ${m}` : ""}`).join(", ")}${some}`, ticks: hours.map((x) => x + Number(m) / 60), fill: false, perDay: hours.length };
  }
  return { when: expr, ticks: [], fill: false, perDay: 0 };
}

/** Ce que fait un déclencheur, d'après son déroulé : ce qu'il lit, écrit, met en file. */
function does(flow: FlowStep[] | undefined): string {
  if (!flow?.length) return "its code has no effect read";
  const ents = (k: string) => [...new Set(flow.filter((s) => s.kind === k).map((s) => s.target?.entity ?? s.target?.topic ?? s.target?.node).filter(Boolean))];
  const parts = [
    ents("read").length ? `reads ${ents("read").join(", ")}` : "",
    ents("write").length ? `writes ${ents("write").join(", ")}` : "",
    ents("message").length ? `enqueues ${ents("message").join(", ")}` : "",
    ents("request").length ? `calls ${ents("request").join(", ")}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "calls functions in the repository, no effect read";
}

/** Sans bloc, tout ce qui tourne ; pour un bloc, ce qui tourne en lui. */
export function triggers(p: MapPayload, scope?: ArchNode): Trigger[] {
  const out: Trigger[] = [];
  const twice = p.model.findings.find((f) => f.code === "scheduled_on_every_instance");
  const byFn = (name?: string) => (name ? p.model.findings.find((f) => f.message.includes(`\`${name}\``)) : undefined);
  const settings = (topic: string) => p.model.nodes.flatMap((n) => n.facets.channel?.topics ?? []).find((t) => t.name === topic)?.settings ?? [];
  for (const n of p.model.nodes.filter((x) => x.level === "deployable" && (!scope || x.id === scope.id))) {
    const machines = n.instances?.min ?? 1;
    for (const e of n.facets.entrypoints ?? []) {
      const name = e.handler?.name && e.handler.name !== "anonymous function" ? e.handler.name : e.key;
      if (e.kind === "schedule") {
        const c = cron(e.key);
        const race = byFn(e.handler?.name);
        const see = race ? { see: sentence(race.message), seeTone: "cr" as const, finding: race } : machines > 1 && twice ? { see: `run ${machines} times, once per machine`, seeTone: "cr" as const, finding: twice } : {};
        out.push({ id: e.id, name, when: c.when, kind: "schedule", node: n, entry: e, machines, ticks: c.ticks, fill: c.fill, perDay: c.perDay * machines, does: does(e.flow), onFail: "the next run picks up; no retry read", ...see });
      } else if (e.kind === "message" || e.kind === "event") {
        const s = settings(e.key);
        const attempts = s.find((x) => /attempt/i.test(x.key))?.value;
        out.push({ id: e.id, name, when: `a message on ${e.key}`, kind: "queue", node: n, entry: e, machines, ticks: [], fill: false, does: does(e.flow), onFail: attempts ? `${attempts} attempts${s.find((x) => /backoff|delay/i.test(x.key)) ? ", with a delay" : ""}` : "not read" });
      } else if (e.kind === "http" && e.access?.level === "signature") {
        const from = e.calledBy?.map((id) => p.model.nodes.find((x) => x.id === id)).find((x) => x?.role === "external");
        out.push({ id: e.id, name: from ? `${from.name}, webhook` : e.key, when: `quand ${from?.name ?? "le service"} envoie`, kind: "webhook", node: n, entry: e, machines, ticks: [], fill: false, does: does(e.flow), onFail: "the service resends, under its own rules; not read" });
      }
    }
  }
  return out;
}
