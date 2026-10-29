import type { FlowStep } from "../../api/types";
import { useSource } from "../../api/useSource";
import { CodeExcerpt } from "../../components/CodeExcerpt";
import styles from "./StepCode.module.css";

const BEFORE = 3;
const AFTER = 6;

/** Le code autour d'une étape ouverte, son commentaire compris, la ligne mise en avant. */
export function StepCode({ step, version }: { step: FlowStep; version: string }) {
  const from = Math.max(1, Math.min(step.why?.proof.line ?? step.proof.line, step.proof.line) - BEFORE);
  const source = useSource({ path: step.proof.path, from, to: step.proof.line + AFTER }, version);
  return (
    <div className={styles.wrap}>
      {source?.status === "ready" && <CodeExcerpt excerpt={source.excerpt} marks={[step.proof.line]} marksLabel="l'étape" />}
      {source?.status === "loading" && <p className={styles.note}>Lecture du passage</p>}
      {source?.status === "error" && <p className={styles.note}>Le passage n'a pas pu être lu : {source.message}</p>}
    </div>
  );
}
