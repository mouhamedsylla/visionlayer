import type { Proof } from "../../api/types";
import { Breakable } from "../Breakable";
import { ProofRef } from "../ProofRef";
import styles from "./PanelVars.module.css";

const NEED = { true: "requise", false: "facultative", unknown: "le code ne dit pas" } as const;

/** Les variables d'environnement lues, une carte chacune : le nom, si elle est requise, où elle est lue. Jamais la valeur. */
export function PanelVars({ vars }: { vars: { name: string; required?: boolean; at: Proof[] }[] }) {
  return (
    <ul className={styles.vars}>
      {vars.map((v) => (
        <li key={v.name} className={v.required ? styles.required : undefined}>
          <span className={styles.name}><Breakable text={v.name} /></span>
          <span className={styles.need}>{NEED[v.required === undefined ? "unknown" : v.required ? "true" : "false"]}</span>
          {v.at[0] && <ProofRef proof={v.at[0]} />}
        </li>
      ))}
    </ul>
  );
}
