import { basename } from "node:path";
import { currentBranch, currentCommit, lastCommitIn } from "../git/local.js";
import type { ProjectInfo } from "./types.js";

/** Le dépôt ouvert : son nom et le commit lu, par Git local seulement (ADR 0006). */
export function projectInfo(root: string): ProjectInfo {
  return {
    name: basename(root),
    branch: currentBranch(root),
    commit: currentCommit(root)?.slice(0, 7),
    lastChange: lastCommitIn(root),
  };
}
