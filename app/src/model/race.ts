import type { Entity, Finding, Proof } from "../api/types";

/**
 * T2, la frise de course (planche L2) : deux exécutions qui se croisent sur une même donnée, dans l'ordre du
 * temps, avec la valeur du champ après chaque étape. Tirée d'un constat, jamais imaginée :
 *  - lue puis réécrite sans revérifier (race_read_then_write) : la fonction du constat d'un côté, l'autre écrivain du champ de l'autre ;
 *  - lue hors de la transaction qui l'écrit (read_outside_tx) : la même fonction, exécutée deux fois en même temps.
 * Les valeurs viennent des écritures du champ à ces lignes ; une valeur calculée reste “calculée”.
 */
export interface RaceStep { side: "l" | "r"; text: string; proof: Proof; value: string; bad?: boolean }
export interface RaceView { left: string; right: string; subject: string; steps: RaceStep[]; verdict: string; sentence: string }

const near = (p: Proof, q: Proof, after = 6) => p.path === q.path && q.line >= p.line - 2 && q.line <= p.line + after;

export function races(entity: Entity, findings: Finding[]): RaceView[] {
  const out: RaceView[] = [];
  for (const f of findings) {
    const race = f.message.match(/^`([^`]+)` reads rows of (\S+) filtered on `([^`]+)`/);
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
          { side: "l", text: `reads the rows, filtered on ${col}`, proof: r, value: "lue" },
          { side: "r", text: `writes ${ow?.value ?? "another value"}`, proof: other, value: ow?.value ?? "computed" },
          { side: "l", text: `rewrites ${uw?.value ?? col} without re-checking ${col}`, proof: u, value: uw?.value ?? "computed", bad: true },
        ],
        verdict: `Nothing prevents it: the write on line ${u.line} doesn't check that \`${col}\` still holds what was read.`,
        sentence: `\`${ow?.fn ?? "other code"}\` writes \`${ow?.value ?? col}\` between the read and the write of \`${fn}\`, which overwrites it.`,
      });
    }
    const out_tx = f.message.match(/^`([^`]+)` reads (\S+) before its transaction/);
    if (f.code === "read_outside_tx" && out_tx && out_tx[2] === entity.name) {
      const fn = out_tx[1]!;
      const r = f.proof[0]!, w = f.proof[1];
      if (!w) continue;
      const written = entity.fields?.find((x) => x.writes?.some((y) => near(w, y.proof)));
      const what = written ? `${entity.name}.${written.name}` : entity.name;
      out.push({
        left: `${fn}, one run`, right: `${fn}, another`, subject: what,
        steps: [
          { side: "l", text: `reads ${entity.name}, and decides`, proof: r, value: "v" },
          { side: "r", text: `reads ${entity.name}, same value`, proof: r, value: "v" },
          { side: "l", text: `writes ${written?.name ?? entity.name}, in its transaction`, proof: w, value: "v′" },
          { side: "r", text: `writes ${written?.name ?? entity.name} from the value read before`, proof: w, value: "v″", bad: true },
        ],
        verdict: `Nothing prevents it: the read on line ${r.line} happens before the transaction; the second run decides from a value the first already changed.`,
        sentence: `Two calls of \`${fn}\` read \`${what}\` at the same time; each writes as if the other didn't exist.`,
      });
    }
  }
  return out;
}
