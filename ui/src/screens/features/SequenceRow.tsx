import type { FlowStep } from "../../api/types";
import { ProofRef } from "../../components/ProofRef";
import type { Lane, StepView } from "../../domain/features/trace";
import { SequenceArrows } from "./SequenceArrows";
import styles from "./SequenceRow.module.css";
import { Breakable } from "../../components/Breakable";

interface Props {
  step: FlowStep;
  view: StepView;
  number: number;
  lanes: Lane[];
  open: boolean;
  onToggle: () => void;
}

/** Une étape : à gauche ce qu'elle fait, sa ligne et pourquoi ; à droite sa flèche d'un couloir à l'autre. */
export function SequenceRow({ step, view, number, lanes, open, onToggle }: Props) {
  return (
    <div className={`${styles.row} ${open ? styles.open : ""} ${step.depth ? styles.nested : ""}`}>
      <button type="button" className={styles.text} style={{ paddingLeft: 14 + step.depth * 20 }} aria-expanded={open} onClick={onToggle}>
        <span className={`${styles.num} ${view.arrow === "back" ? styles.back : ""}`}>{number}</span>
        <span className={styles.body}>
          <span className={styles.title}>{view.title}</span>
          {view.when && !(step.when && step.proof.text?.includes(step.when)) && <span className={styles.when}><Breakable text={view.when} /></span>}
          {step.proof.text && <code className={styles.code}><Breakable text={step.proof.text} /></code>}
          {step.why && <span className={styles.why}>« {step.why.text} »</span>}
          <span className={styles.origin}>
            <i className={step.why ? styles.comment : styles.extracted} aria-hidden="true" />
            {step.why ? "commentaire" : "extrait du code"}
            <ProofRef proof={step.proof} plain />
          </span>
        </span>
      </button>
      <SequenceArrows view={view} number={number} lanes={lanes} />
    </div>
  );
}
