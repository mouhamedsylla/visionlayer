import type { PackProposal } from "../api/types";

/**
 * Ce que la planche 02 (Atelier de pack) montre d'une proposition, lu dans ce que l'écrivain a déposé :
 * l'inventaire des formes (sa page), ses tests, ses règles, l'essai à part sur le projet.
 */

export interface Form { n: string; form: string; example: string; state: string; read: boolean }

/** Le tableau des formes de la page du pack : une ligne par forme de l'API, lue ou non lue avec sa raison. */
export function forms(p: PackProposal): Form[] {
  const rows = p.doc.split("\n").filter((l) => /^\|\s*\d+\s*\|/.test(l));
  return rows.map((l) => {
    const c = l.split("|").slice(1, -1).map((x) => x.trim());
    const state = c[3] ?? "";
    return { n: c[0] ?? "", form: c[1] ?? "", example: c[2] ?? "", state, read: /^lu\b/.test(state) };
  });
}

/** Le titre et le premier paragraphe de la page du pack. */
export function intro(p: PackProposal): { title: string; text: string } {
  const lines = p.doc.split("\n");
  const title = (lines.find((l) => l.startsWith("# ")) ?? `# ${p.name}`).slice(2);
  const text = lines.find((l, i) => i > 0 && l.trim() && !l.startsWith("#") && !l.startsWith("|")) ?? "";
  return { title, text };
}

export interface Step { n: string; label: string; count: string; done: boolean }

/** Les cinq étapes de la recette, et où en est la proposition. */
export function steps(p: PackProposal): Step[] {
  const f = forms(p);
  const ok = p.preview?.state.status === "active";
  return [
    { n: "1", label: "Inventaire", count: `${f.length} formes`, done: f.length > 0 },
    { n: "2", label: "Tests", count: ok ? `${p.tests.length} sur ${p.tests.length} passent` : "à revoir", done: ok },
    { n: "3", label: "Règles", count: `${p.rules.length} règle${p.rules.length > 1 ? "s" : ""}`, done: true },
    { n: "4", label: "Vérification", count: ok ? "5 sur 5" : p.preview?.state.reason ? "refusé" : "en attente", done: ok },
    { n: "5", label: "Différence", count: "à décider", done: false },
  ];
}

/** Les vérifications que VisionLayer fait avant tout chargement (ADR 0019), et leur résultat. */
export function checks(p: PackProposal): { title: string; note: string; ok: boolean }[] {
  const s = p.preview?.state;
  const reason = s?.reason ?? "";
  const failedAt = (k: RegExp) => s?.status === "failed" && k.test(reason);
  return [
    { title: "Schéma strict du pack", note: "aucun champ inconnu, aucun script", ok: !failedAt(/schéma|script|champ/) },
    { title: `${p.tests.length} tests de forme`, note: "un petit fichier d'exemple par forme, hors du projet", ok: !failedAt(/test/) },
    { title: "Il produit ce qu'il déclare", note: `${p.provides.length} relations déclarées`, ok: !failedAt(/déclarer|provides|arguments/) },
    { title: "Déclarations sans cycle", note: "aucune boucle avec les autres packs du projet", ok: !failedAt(/cycle/) },
    { title: "Chargé à part, la carte acceptée intacte", note: s?.status === "failed" ? reason : "essayé dans un domaine isolé avant la décision", ok: s?.status !== "failed" },
  ];
}
