import { execFileSync } from "node:child_process";
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
    // Une démonstration publique ne salue personne : le nom vient de la machine qui la sert.
    ...(process.env.VISION_DEMO ? {} : { user: gitUser(root) }),
  };
}

/** Le nom que Git donne à la personne (`user.name`), lu localement. */
function gitUser(root: string): string | undefined {
  try { return execFileSync("git", ["config", "user.name"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined; } catch { return undefined; }
}
