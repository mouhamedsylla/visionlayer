import type { Pipeline, PipelineJob, StepKind } from "../../api/types";

/** Les jobs en colonnes : un job vient après tous ceux qu'il attend (`needs`). */
export function jobColumns(p: Pipeline): PipelineJob[][] {
  const depth = new Map<string, number>();
  const of = (j: PipelineJob, seen: Set<string> = new Set()): number => {
    if (depth.has(j.id)) return depth.get(j.id)!;
    if (seen.has(j.id)) return 0;
    seen.add(j.id);
    const d = Math.max(-1, ...j.needs.map((n) => p.jobs.find((x) => x.id === n)).filter((x): x is PipelineJob => !!x).map((x) => of(x, seen))) + 1;
    depth.set(j.id, d);
    return d;
  };
  const cols: PipelineJob[][] = [];
  for (const j of p.jobs) (cols[of(j)] ??= []).push(j);
  return cols.filter(Boolean);
}

export const STEP_WORD: Record<StepKind, string> = {
  checkout: "récupère le code", setup: "prépare l'outil", install: "installe", check: "vérifie",
  build: "construit", image: "image", deploy: "déploie", other: "lance",
};

/** Les étapes qui déploient, dans tous les workflows. */
export const deploySteps = (pipelines: Pipeline[]) =>
  pipelines.flatMap((p) => p.jobs.flatMap((j) => j.steps.filter((s) => s.kind === "deploy").map((s) => ({ p, j, s }))));
