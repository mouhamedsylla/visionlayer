const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

const hour = (h: string, m: string) => `${Number(h)} h${m === "0" ? "" : ` ${m.padStart(2, "0")}`}`;

/**
 * Une expression cron dite en mots, pour les formes courantes : `* * * * *` →
 * « chaque minute », `0 8 * * *` → « chaque jour à 8 h ». Une autre forme est
 * rendue telle qu'écrite, jamais devinée.
 */
export function cronLabel(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [m, h, dom, mon, dow] = parts as [string, string, string, string, string];
  const everyDay = dom === "*" && mon === "*";
  if (parts.every((p) => p === "*")) return "chaque minute";
  const step = /^\*\/(\d+)$/.exec(m);
  if (step && h === "*" && everyDay && dow === "*") return `toutes les ${step[1]} minutes`;
  const fixed = /^\d+$/.test(m) && /^\d+$/.test(h);
  if (fixed && everyDay && dow === "*") return `chaque jour à ${hour(h, m)}`;
  if (fixed && everyDay && /^[0-6]$/.test(dow)) return `chaque ${DAYS[Number(dow)]} à ${hour(h, m)}`;
  if (/^\d+$/.test(m) && h === "*" && everyDay && dow === "*") return `chaque heure à la minute ${m}`;
  return expr;
}
