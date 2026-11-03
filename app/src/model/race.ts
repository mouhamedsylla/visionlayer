import type { Entity, Finding, Proof } from "../api/types";

/**
 * T2, la frise de course (planche L2) : deux exécutions qui se croisent sur une même donnée, dans l'ordre du
 * temps, avec la valeur du champ après chaque étape. Tirée d'un constat, jamais imaginée :
 *  - lue puis réécrite sans revérifier (race_read_then_write) : la fonction du constat d'un côté, l'autre écrivain du champ de l'autre ;
 *  - lue hors de la transaction qui l'écrit (read_outside_tx) : la même fonction, exécutée deux fois en même temps.
 * Les valeurs viennent des écritures du champ à ces lignes ; une valeur calculée reste « calculée ».
 */
export interface RaceStep { side: "l" | "r"; text: string; proof: Proof; value: string; bad?: boolean }
export interface RaceView { left: string; right: string; subject: string; steps: RaceStep[]; verdict: string; sentence: string }

const near = (p: Proof, q: Proof, after = 6) => p.path === q.path && q.line >= p.line - 2 && q.line <= p.line + after;

export function races(entity: Entity, findings: Finding[]): RaceView[] {
  const out: RaceView[] = [];
  for (const f of findings) {
    const race = f.message.match(/^`([^`]+)` lit des lignes de (\S+) filtrées sur `([^`]+)`/);
    if (f.code === "race_read_then_write" && race && race[2] === entity.name) {
      const [, fn, , col] = race as unknown as [string, string, string, string];
      const field = entity.fields?.find((x) => x.name === col);
      const r = f.proof[0]!;
      const u = f.proof.find((p) => p.path === r.path && p.line > r.line);
      const other = f.proof.find((p) => p.path !== r.path);
      if (!u || !other) continue;
      const at = (p: Proof) => field?.writes?.find((w) => near(p, w.proof));
      const ow = at(other), uw = at(u);
      out.push({
        left: fn, right: ow?.fn ?? other.path.split("/").pop()!, subject: `${entity.name}.${col}`,
        steps: [
          { side: "l", text: `lit les lignes, filtrées sur ${col}`, proof: r, value: "lue" },
          { side: "r", text: `écrit ${ow?.value ?? "une autre valeur"}`, proof: other, value: ow?.value ?? "calculée" },
          { side: "l", text: `réécrit ${uw?.value ?? col} sans revérifier ${col}`, proof: u, value: uw?.value ?? "calculée", bad: true },
        ],
        verdict: `Rien ne l'empêche : l'écriture de la ligne ${u.line} ne vérifie pas que \`${col}\` vaut encore ce qui a été lu.`,
        sentence: `\`${ow?.fn ?? "un autre code"}\` écrit \`${ow?.value ?? col}\` entre la lecture et l'écriture de \`${fn}\`, qui l'écrase.`,
      });
    }
    const out_tx = f.message.match(/^`([^`]+)` lit (\S+) avant sa transaction/);
    if (f.code === "read_outside_tx" && out_tx && out_tx[2] === entity.name) {
      const fn = out_tx[1]!;
      const r = f.proof[0]!, w = f.proof[1];
      if (!w) continue;
      const written = entity.fields?.find((x) => x.writes?.some((y) => near(w, y.proof)));
      const what = written ? `${entity.name}.${written.name}` : entity.name;
      out.push({
        left: `${fn}, une exécution`, right: `${fn}, une autre`, subject: what,
        steps: [
          { side: "l", text: `lit ${entity.name}, et décide`, proof: r, value: "v" },
          { side: "r", text: `lit ${entity.name}, la même valeur`, proof: r, value: "v" },
          { side: "l", text: `écrit ${written?.name ?? entity.name}, dans sa transaction`, proof: w, value: "v′" },
          { side: "r", text: `écrit ${written?.name ?? entity.name} d'après la valeur lue avant`, proof: w, value: "v″", bad: true },
        ],
        verdict: `Rien ne l'empêche : la lecture de la ligne ${r.line} est faite avant la transaction ; la seconde exécution décide d'après une valeur que la première a déjà changée.`,
        sentence: `Deux appels de \`${fn}\` lisent \`${what}\` en même temps ; chacun écrit comme si l'autre n'existait pas.`,
      });
    }
  }
  return out;
}
