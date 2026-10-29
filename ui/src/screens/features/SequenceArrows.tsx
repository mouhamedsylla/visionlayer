import type { Lane, StepView } from "../../domain/features/trace";
import styles from "./SequenceArrows.module.css";

const center = (lanes: Lane[], id: string) => {
  const i = Math.max(0, lanes.findIndex((l) => l.id === id));
  return ((i + 0.5) / lanes.length) * 100;
};

/** La partie droite d'une étape : les lignes de vie de chaque couloir, et la flèche de l'étape, numérotée à son départ. */
export function SequenceArrows({ view, number, lanes }: { view: StepView; number: number; lanes: Lane[] }) {
  const [a, b] = [center(lanes, view.from), center(lanes, view.to)];
  return (
    <div className={styles.lanes} aria-hidden="true">
      {lanes.map((l) => <i key={l.id} className={styles.life} style={{ left: `${center(lanes, l.id)}%` }} />)}
      {view.arrow !== "none" && a !== b && (
        <span className={`${styles.arrow} ${styles[view.arrow]} ${b < a ? styles.leftward : ""}`} style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(b - a)}%` }} />
      )}
      <span className={`${styles.marker} ${styles[view.arrow]}`} style={{ left: `${a}%` }}>{number}</span>
    </div>
  );
}
