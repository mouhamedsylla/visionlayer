import type { Proof } from "../api/types";
import { CodeRef } from "./CodeRef";
import { useOpenCode } from "./code";

/** Une preuve qui ouvre son code sur place au clic. */
export function Ref({ proof, className }: { proof: Pick<Proof, "path" | "line" | "text">; className?: string }) {
  const open = useOpenCode();
  return <CodeRef proof={proof} onOpen={open} className={className} />;
}
