import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertWithinRepo } from "../model/paths.js";
import { listProjectFiles, type ProjectFile } from "../scanner/files.js";
import { readGithubWorkflow } from "./github-actions.js";
import type { DeployModel } from "./types.js";

const WORKFLOW = /^\.github\/workflows\/[^/]+\.ya?ml$/;

/** Les chaînes de livraison du dépôt. Aujourd'hui les workflows GitHub Actions ; les autres ne sont pas encore lues. */
export function buildDeployModel(root: string, files: ProjectFile[] = listProjectFiles(root)): DeployModel {
  const pipelines = files.filter((f) => WORKFLOW.test(f.path)).map((f) => {
    assertWithinRepo(root, f.path);
    return readGithubWorkflow(f.path, readFileSync(join(root, f.path), "utf8"));
  });
  return { pipelines };
}
