/**
 * Les moments d'une journée où une expression cron se lance, en minutes depuis
 * minuit. Une tâche qui part plus de 48 fois par jour est dite « en continu »
 * avec son pas. Une expression qu'on ne sait pas lire donne `undefined` :
 * elle n'est pas placée sur la journée plutôt que devinée.
 */
export interface DayRuns {
  /** Toutes les N minutes, sur toute la journée ou certaines heures. */
  every?: number;
  /** En continu : les plages couvertes, en minutes, les heures qui se suivent réunies. */
  spans?: [number, number][];
  times: number[];
  /** Le jour du mois, le mois ou le jour de la semaine restreint : pas tous les jours. */
  someDays: boolean;
}

const MAX_MARKS = 48;
const PART = /^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/;

function field(text: string, min: number, max: number): number[] | undefined {
  const out = new Set<number>();
  for (const part of text.split(",")) {
    const m = part.match(PART);
    if (!m) return undefined;
    const from = m[1] === "*" ? min : Number(m[2]);
    const to = m[1] === "*" ? max : m[3] !== undefined ? Number(m[3]) : m[4] ? max : from;
    const step = m[4] ? Number(m[4]) : 1;
    if (from < min || to > max || step < 1) return undefined;
    for (let v = from; v <= to; v += step) out.add(v);
  }
  return [...out].sort((a, b) => a - b);
}

export function dayRuns(expr: string): DayRuns | undefined {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return undefined;
  const [m, h, dom, mon, dow] = parts as [string, string, string, string, string];
  const minutes = field(m, 0, 59);
  const hours = field(h, 0, 23);
  if (!minutes || !hours || !field(dom, 1, 31) || !field(mon, 1, 12) || !field(dow, 0, 7)) return undefined;
  const times = hours.flatMap((hh) => minutes.map((mm) => hh * 60 + mm));
  const someDays = !(dom === "*" && mon === "*" && dow === "*");
  if (times.length <= MAX_MARKS) return { times, someDays };
  const every = minutes.length > 1 ? minutes[1]! - minutes[0]! : 60;
  const spans: [number, number][] = [];
  for (const hh of hours) {
    const last = spans.at(-1);
    if (last && last[1] === hh * 60) last[1] += 60;
    else spans.push([hh * 60, hh * 60 + 60]);
  }
  return { every, times: hours.map((hh) => hh * 60), spans, someDays };
}

/** `3 h`, `18 h 30`. */
export function clock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}`;
}
