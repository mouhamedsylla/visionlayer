import type { CSSProperties } from "react";
import { useSource } from "../../api/useSource";
import { CodeExcerpt } from "../../components/CodeExcerpt";
import { ProofRef } from "../../components/ProofRef";
import type { Lane, Step } from "../../domain/data/lifecycle";
import styles from "./FlowStep.module.css";

interface Props {
  index: number;
  step: Step;
  lanes: Lane[];
  field: string;
  columns: CSSProperties;
  version: string;
  selected: boolean;
  onSelect: () => void;
}

const center = (i: number, n: number) => ((i + 0.5) / n) * 100;

/** Une flèche d'un couloir à l'autre, à la hauteur de la ligne. */
function Arrow({ from, to, n, kind }: { from: number; to: number; n: number; kind: "call" | "write" }) {
  if (from < 0 || to < 0 || from === to) return null;
  const [a, b] = [center(from, n), center(to, n)];
  return (
    <span className={`${styles.arrow} ${styles[kind]}`} style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(b - a)}%` }}>
      <i className={b > a ? styles.headRight : styles.headLeft} />
    </span>
  );
}

/** Une écriture : la fonction, la valeur, ce qui l'a déclenchée ; ouverte, le code autour de la ligne. */
export function FlowStep({ index, step, lanes, field, columns, version, selected, onSelect }: Props) {
  const at = (id?: string) => (id ? lanes.findIndex((l) => l.id === id) : -1);
  const n = lanes.length;
  const span = selected ? { path: step.proof.path, from: Math.max(1, step.proof.line - 4), to: step.proof.line + 4 } : undefined;
  const source = useSource(span, version);
  return (
    <>
      <button type="button" className={`${styles.row} ${selected ? styles.selected : ""}`} style={columns} onClick={onSelect} aria-expanded={selected}>
        <span className={styles.text}>
          <span className={styles.num}>{index + 1}</span>
          <span>
            <span className={styles.title}>
              <code>{step.fn ?? "code"}</code> écrit {field} {step.value !== undefined ? <span className={styles.value}>{step.value}</span> : <span className={styles.open}>valeur calculée</span>}
            </span>
            <span className={styles.sub}>{[step.via, step.from && step.from.role === "caller" ? `appelé par ${step.from.label}` : ""].filter(Boolean).join(" · ")}</span>
            <span className={styles.proof}><i className={styles.line} />extrait du code<ProofRef proof={step.proof} plain /></span>
          </span>
        </span>
        <span className={styles.track}>
          {lanes.map((l, i) => <i key={l.id} className={styles.life} style={{ left: `${center(i, n)}%` }} />)}
          <Arrow from={at(step.from?.id)} to={at(step.actor.id)} n={n} kind="call" />
          <Arrow from={at(step.actor.id)} to={at("entity")} n={n} kind="write" />
        </span>
      </button>
      {selected && source?.status === "ready" && (
        <div className={styles.code}><CodeExcerpt excerpt={source.excerpt} marks={[step.proof.line]} marksLabel="écriture" /></div>
      )}
      {selected && source?.status === "error" && <p className={styles.code}>Le code n'a pas pu être lu : {source.message}</p>}
    </>
  );
}
