import type { Proof } from "../../api/types";
import { Breakable } from "../../components/Breakable";
import { ProofRef } from "../../components/ProofRef";
import styles from "./TechRows.module.css";

interface Props {
  label?: string;
  /** La ligne de code telle qu'écrite, quand elle est connue. */
  code?: string;
  where: string;
  proof?: Pick<Proof, "path" | "line">;
}

/** Une ligne du panneau : ce qui est écrit, puis l'endroit ; un clic sur la ligne citée ouvre son code. */
export function TechRows({ label, code, where, proof }: Props) {
  return (
    <div className={styles.row}>
      <span className={styles.text}>
        {label && <span className={styles.label}>{label}</span>}
        {code && <code className={styles.code}><Breakable text={code.trim()} /></code>}
      </span>
      {proof ? <ProofRef proof={proof} /> : <span className={styles.where}><Breakable text={where} /></span>}
    </div>
  );
}
