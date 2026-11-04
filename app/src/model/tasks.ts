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
  if (m === "*" && h === "*") return { when: `chaque minute${some}`, ticks: [], fill: true, perDay: 1440 };
  if (step(m) && h === "*") return { when: `toutes les ${step(m)} minutes${some}`, ticks: [], fill: true, perDay: Math.floor(1440 / step(m)!) };
  if (/^\d+$/.test(m) && h === "*") return { when: `chaque heure à ${m} min${some}`, ticks: Array.from({ length: 24 }, (_, i) => i + Number(m) / 60), fill: false, perDay: 24 };
  if (/^\d+$/.test(m) && step(h)) return { when: `toutes les ${step(h)} h${some}`, ticks: Array.from({ length: Math.ceil(24 / step(h)!) }, (_, i) => i * step(h)! + Number(m) / 60), fill: false, perDay: Math.ceil(24 / step(h)!) };
  if (/^\d+$/.test(m) && /^[\d,]+$/.test(h)) {
    const hours = h.split(",").map(Number);
    return { when: `chaque jour à ${hours.map((x) => `${x} h${m !== "0" ? ` ${m}` : ""}`).join(", ")}${some}`, ticks: hours.map((x) => x + Number(m) / 60), fill: false, perDay: hours.length };
  }
  return { when: expr, ticks: [], fill: false, perDay: 0 };
}

/** Ce que fait un déclencheur, d'après son déroulé : ce qu'il lit, écrit, met en file. */
function does(flow: FlowStep[] | undefined): string {
  if (!flow?.length) return "son code n'a pas d'effet lu";
  const ents = (k: string) => [...new Set(flow.filter((s) => s.kind === k).map((s) => s.target?.entity ?? s.target?.topic ?? s.target?.node).filter(Boolean))];
  const parts = [
    ents("read").length ? `lit ${ents("read").join(", ")}` : "",
    ents("write").length ? `écrit ${ents("write").join(", ")}` : "",
    ents("message").length ? `met en file ${ents("message").join(", ")}` : "",
    ents("request").length ? `appelle ${ents("request").join(", ")}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "appelle des fonctions du dépôt, sans effet lu";
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
      const name = e.handler?.name && e.handler.name !== "fonction anonyme" ? e.handler.name : e.key;
      if (e.kind === "schedule") {
        const c = cron(e.key);
        const race = byFn(e.handler?.name);
        const see = race ? { see: sentence(race.message), seeTone: "cr" as const, finding: race } : machines > 1 && twice ? { see: `lancée ${machines} fois, une par machine`, seeTone: "cr" as const, finding: twice } : {};
        out.push({ id: e.id, name, when: c.when, kind: "schedule", node: n, entry: e, machines, ticks: c.ticks, fill: c.fill, perDay: c.perDay * machines, does: does(e.flow), onFail: "la prochaine exécution reprend ; aucune reprise lue", ...see });
      } else if (e.kind === "message" || e.kind === "event") {
        const s = settings(e.key);
        const attempts = s.find((x) => /attempt/i.test(x.key))?.value;
        out.push({ id: e.id, name, when: `un message sur ${e.key}`, kind: "queue", node: n, entry: e, machines, ticks: [], fill: false, does: does(e.flow), onFail: attempts ? `${attempts} tentatives${s.find((x) => /backoff|delay/i.test(x.key)) ? ", avec un délai" : ""}` : "non lu" });
      } else if (e.kind === "http" && e.access?.level === "signature") {
        const from = e.calledBy?.map((id) => p.model.nodes.find((x) => x.id === id)).find((x) => x?.role === "external");
        out.push({ id: e.id, name: from ? `${from.name}, webhook` : e.key, when: `quand ${from?.name ?? "le service"} envoie`, kind: "webhook", node: n, entry: e, machines, ticks: [], fill: false, does: does(e.flow), onFail: "le service renvoie, selon ses propres règles ; non lu" });
      }
    }
  }
  return out;
}
