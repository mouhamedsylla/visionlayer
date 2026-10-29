import type { Proof } from "../../api/types";

/** `queue.ts:4` : le nom du fichier et la ligne ; le chemin entier reste dans `path`. */
export function proofLabel(proof: Pick<Proof, "path" | "line">): string {
  const file = proof.path.split("/").pop() ?? proof.path;
  return proof.line > 0 ? `${file}:${proof.line}` : file;
}
