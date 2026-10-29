import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SystemModel } from "./types.js";

/**
 * Abstraction de stockage (ADR 0003) — fichiers JSON locaux pour le MVP.
 * Les modules consommateurs (context/, diff/, report/) doivent passer par
 * readModel()/writeModel(), jamais lire .vision/model.json directement,
 * pour qu'une migration future de format n'impacte que ce fichier.
 */

export function writeModel(root: string, model: SystemModel): void {
  const visionDir = join(root, ".vision");
  mkdirSync(visionDir, { recursive: true });
  writeFileSync(join(visionDir, "model.json"), JSON.stringify(model, null, 2) + "\n");
  writeFileSync(
    join(visionDir, "metadata.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        fileCount: model.files.length,
        dependencyCount: model.dependencies.length,
      },
      null,
      2,
    ) + "\n",
  );
}

export function readModel(root: string): SystemModel {
  const raw = readFileSync(join(root, ".vision", "model.json"), "utf-8");
  return JSON.parse(raw) as SystemModel;
}
