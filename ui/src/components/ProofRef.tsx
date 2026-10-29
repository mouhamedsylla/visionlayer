import { useRef, useState } from "react";
import type { Proof } from "../api/types";
import { proofLabel } from "../domain/text/proof";
import { CodePeek } from "./CodePeek";
import styles from "./ProofRef.module.css";

interface Props {
  proof: Pick<Proof, "path" | "line"> & Partial<Proof>;
  /** Dans une ligne déjà cliquable (un lien, un bouton) : le repère seul, sans ouvrir le code. */
  plain?: boolean;
}

/** La ligne qui prouve un fait, écrite `fichier:ligne` ; un clic ouvre le passage de code autour d'elle. */
export function ProofRef({ proof, plain = false }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const label = proofLabel(proof);
  if (plain) return <span className={styles.ref} data-proof="" title={`${proof.path}:${proof.line}`}>{label}</span>;
  return (
    <>
      <button ref={ref} type="button" className={`${styles.ref} ${styles.open} ${open ? styles.on : ""}`} data-proof=""
        title={`${proof.path}:${proof.line} · voir le code`} aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
        {label}
      </button>
      {open && <CodePeek proof={proof} anchor={ref} onClose={() => setOpen(false)} />}
    </>
  );
}
