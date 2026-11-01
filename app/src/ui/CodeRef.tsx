import type { Proof } from "../api/types";

/** `dossier/fichier:ligne`, le fichier en gras (CodeRef du design système) ; ouvre le code au clic. */
export function CodeRef({ proof, onOpen, className = "" }: { proof: Pick<Proof, "path" | "line" | "text">; onOpen?: (p: Pick<Proof, "path" | "line">) => void; className?: string }) {
  const cut = proof.path.lastIndexOf("/");
  const parts = proof.path.slice(0, cut + 1).split("/").filter(Boolean);
  const dir = parts.length > 2 ? `${parts.slice(-2).join("/")}/` : proof.path.slice(0, cut + 1);
  return (
    <button type="button" className={`vl-ref ${className}`} title={proof.text?.trim() || proof.path} onClick={() => onOpen?.(proof)}>
      {dir}<b>{proof.path.slice(cut + 1)}</b>{proof.line > 0 ? `:${proof.line}` : ""}
    </button>
  );
}
