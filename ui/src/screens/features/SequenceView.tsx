import { Fragment, useState } from "react";
import type { FlowStep, MapPayload } from "../../api/types";
import { Pill } from "../../components/Pill";
import { stepView, traceLanes, type Lane, type StepView } from "../../domain/features/trace";
import type { EntryRef } from "../../domain/features/list";
import { SequenceRow } from "./SequenceRow";
import { StepCode } from "./StepCode";
import styles from "./SequenceView.module.css";
import { Breakable } from "../../components/Breakable";
import { useWidth } from "../../components/useWidth";

/** La place qu'il faut à un couloir pour que son nom tienne sans se couper, et au texte d'une étape à côté. */
const LANE_MIN = 104;
const TEXT_MIN = 300;

interface Props {
  item: EntryRef;
  map: MapPayload;
  names: Map<string, string>;
  /** Un tracé composé ailleurs (la vie d'un appel à un contrat) ; sinon, le déroulé du point d'entrée. */
  trace?: { lanes: Lane[]; rows: { step: FlowStep; view: StepView }[] };
}

/** Le déroulé en couloirs : une ligne par étape, sa flèche du code vers ce qu'il touche, et son code au clic. */
export function SequenceView({ item, map, names, trace }: Props) {
  const lanes = trace?.lanes ?? traceLanes(item, map.model, names);
  const rows = trace?.rows ?? (item.entry.flow ?? []).map((s) => ({ step: s, view: stepView(s, item.node.id, names) }));
  const [open, setOpen] = useState<number>();
  const [ref, width] = useWidth<HTMLDivElement>();
  // trop étroit pour mettre le texte à côté : il passe au-dessus de ses flèches, les couloirs gardent toute la largeur
  const stacked = width > 0 && width < TEXT_MIN + lanes.length * LANE_MIN;
  const columns = stacked ? "minmax(0, 1fr)" : `minmax(${TEXT_MIN}px, 440px) minmax(0, 1fr)`;
  return (
    <div ref={ref} className={styles.sequence} style={{ "--sequence-columns": columns } as React.CSSProperties}>
      <div className={styles.head}>
        {!stacked && <span className={styles.caption}><Pill>étape · pourquoi</Pill></span>}
        <div className={styles.lanes} style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))` }}>
          {lanes.map((l) => (
            <div key={l.id} className={`${styles.lane} ${l.id === item.node.id ? styles.own : ""}`}>
              <span className={styles.title}><Breakable text={l.title} /></span>
              <span className={styles.sub}><Breakable text={l.sub} /></span>
            </div>
          ))}
        </div>
      </div>
      {rows.map(({ step, view }, i) => (
        <Fragment key={i}>
          <SequenceRow step={step} view={view} number={i + 1} lanes={lanes} open={open === i} onToggle={() => setOpen((o) => (o === i ? undefined : i))} />
          {open === i && <StepCode step={step} version={map.builtAt} />}
        </Fragment>
      ))}
    </div>
  );
}
