import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildModel } from "./build.js";
import { writeModel } from "./store.js";
import { archiveCurrentAsPrevious } from "./history.js";
import { toMermaid } from "../graph/mermaid.js";
import { currentCommit } from "../git/local.js";
import { buildInfraModel } from "../infra/build.js";
import { writeInfraModel } from "../infra/store.js";
import type { InfraModel } from "../infra/types.js";
import { buildStackModel } from "../stack/build.js";
import { writeStackModel } from "../stack/store.js";
import type { StackModel } from "../stack/types.js";
import { buildArchModel } from "../arch/build.js";
import { writeArchModel } from "../arch/store.js";
import type { ArchModel } from "../arch/types.js";
import type { SystemModel } from "./types.js";

export interface ScanOutcome {
  model: SystemModel;
  infra: InfraModel;
  stack: StackModel;
  arch: ArchModel;
  filesWithErrors: string[];
  commit?: string;
  visionDir: string;
}

/**
 * Cœur de `vision scan` (archive=false) et `vision update` (archive=true),
 * partagé par les CLI et par le serveur de l'interface (ADR 0009) — une
 * seule implémentation de l'écriture du modèle.
 */
export function scanRepository(root: string, options: { archive: boolean }): ScanOutcome {
  if (options.archive) archiveCurrentAsPrevious(root);

  const model = buildModel(root);
  writeModel(root, model);

  const visionDir = join(root, ".vision");
  mkdirSync(visionDir, { recursive: true });
  writeFileSync(join(visionDir, "graph.mmd"), toMermaid(model));

  const infra = buildInfraModel(root);
  writeInfraModel(root, infra);

  const stack = buildStackModel(root, model, infra);
  writeStackModel(root, stack);

  const arch = buildArchModel(root, model, infra);
  writeArchModel(root, arch);

  return {
    model,
    infra,
    stack,
    arch,
    filesWithErrors: model.files.filter((f) => f.parseError).map((f) => f.path),
    commit: options.archive ? currentCommit(root) : undefined,
    visionDir,
  };
}
