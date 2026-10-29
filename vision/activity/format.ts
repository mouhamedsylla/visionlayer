import type { CostReport } from "./cost.js";

const n = (x: number) => Math.round(x).toLocaleString("fr-FR");
const money = (x: number | undefined, cur?: string) => (x === undefined ? "" : `  ≈ ${x.toFixed(2)} ${cur ?? ""}`.trimEnd());

/** Sortie texte de `vision cost`. */
export function formatCostReport(r: CostReport): string {
  const out: string[] = ["COÛT DES AGENTS PAR FEATURE", "────────────────────────────────", ""];
  if (!r.sessions.length) {
    out.push("Aucune session d'agent dans le journal (.vision/activity/). Branchez les hooks : voir README, « Journal d'activité ».");
    return out.join("\n") + "\n";
  }
  if (!r.priced) out.push("Tokens seulement : aucun tarif déclaré dans .vision/prices.json.", "");
  out.push(`PAR FEATURE (${r.targets.length})`);
  for (const t of r.targets) {
    const label = t.kind === "feature" ? t.name : t.kind === "block" ? `${t.name} (hors feature)` : "hors carte";
    out.push(`  ${label.padEnd(32)} ${n(t.tokens).padStart(12)} tokens${money(t.cost, r.currency)}  · ${t.shares.length} session${t.shares.length > 1 ? "s" : ""}`);
  }
  out.push("", `SESSIONS (${r.sessions.length})`);
  for (const s of r.sessions) {
    const u = s.usage;
    out.push(`  ${s.agent} ${s.session.slice(0, 8)}  ${s.end.slice(0, 16).replace("T", " ")}  ${s.model ?? "?"}  ${n(s.tokens)} tokens${money(s.cost, r.currency)}`);
    if (u) out.push(`      entrée ${n(u.input)} · cache lu ${n(u.cacheRead)} · cache écrit ${n(u.cacheWrite)} · sortie ${n(u.output)}`);
    out.push(`      ${s.files.length} fichier${s.files.length > 1 ? "s" : ""} modifié${s.files.length > 1 ? "s" : ""} · carte lue ${s.mapReads} fois${s.files.length ? (s.mapReadBeforeFirstEdit ? " (avant d'écrire)" : " — pas avant d'écrire") : ""}`);
  }
  if (r.unattributed.length) {
    const tot = r.unattributed.reduce((a, s) => a + s.tokens, 0);
    out.push("", `SANS MODIFICATION (${r.unattributed.length} sessions, ${n(tot)} tokens) : exploration ou questions, imputées à aucune feature.`);
  }
  return out.join("\n") + "\n";
}
