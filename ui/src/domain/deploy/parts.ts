import type { ArchModelV2, ArchNode, DeployPayload, Pipeline, PipelineJob, PipelineStep, Proof } from "../../api/types";

/** Un manifeste qui déclare une partie : le pack qui l'a lu (`Fly.io`) et la ligne. */
export interface Declaration {
  pack: string;
  name: string;
  tech?: string;
  proof: Proof;
}

/** Une partie du système vue du déploiement : ce qui la déclare, combien, où, et ce qui la livre. */
export interface DeployPart {
  node: ArchNode;
  declared: Declaration[];
  /** Les autres fichiers qui le font exister sans dire où il tourne (une page web, un paquet). */
  seenIn: Declaration[];
  /** Sans manifeste : les variables lues à la ligne où le code la trouve (`DATABASE_URL`). */
  readVia: { name: string; proof: Proof }[];
  /** Les étapes de workflow qui déploient vers la technologie d'un de ses manifestes. */
  shippedBy: { pipeline: Pipeline; job: PipelineJob; step: PipelineStep }[];
}

const RUNS = new Set(["app", "service", "function", "worker", "job", "binary", "store", "channel", "managed"]);

function declarations(node: ArchNode, packs: DeployPayload["packs"], deploys: boolean): Declaration[] {
  const seen = new Set<string>();
  return node.proof.filter((p) => p.source === "manifest" && p.pack).flatMap((p) => {
    const key = `${p.pack}\0${p.path}`;
    if (seen.has(key) || !!packs[p.pack!]?.deploys !== deploys) return [];
    seen.add(key);
    const pack = packs[p.pack!];
    return [{ pack: p.pack!, name: pack?.name ?? p.pack!, ...(pack?.tech[0] ? { tech: pack.tech[0] } : {}), proof: p }];
  });
}

/** Les déployables, stockages et files de la carte, dans l'ordre de la carte. */
export function deployParts(model: ArchModelV2, payload: DeployPayload): DeployPart[] {
  const steps = payload.deploy.pipelines.flatMap((pipeline) => pipeline.jobs.flatMap((job) => job.steps.map((step) => ({ pipeline, job, step }))));
  return model.nodes.filter((n) => n.level === "deployable" && RUNS.has(n.role)).map((node) => {
    const declared = declarations(node, payload.packs, true);
    const seenIn = declarations(node, payload.packs, false);
    const techs = new Set(declared.flatMap((d) => payload.packs[d.pack]?.tech ?? []));
    const env = model.nodes.flatMap((n) => n.facets.config?.env ?? []);
    const readVia = declared.length ? [] : node.proof.flatMap((p) => {
      const v = env.find((e) => e.readAt.some((r) => r.path === p.path && r.line === p.line));
      return v ? [{ name: v.name, proof: p }] : [];
    });
    return { node, declared, seenIn, readVia, shippedBy: steps.filter((s) => s.step.kind === "deploy" && s.step.target && techs.has(s.step.target)) };
  });
}
