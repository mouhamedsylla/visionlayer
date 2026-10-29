import type { ArchModelV2 } from "../../api/types";
import type { EntryRef } from "../../domain/features/list";
import { clock, dayRuns } from "../../domain/messages/day";
import { launchesOf, whenLabel } from "../../domain/messages/triggers";
import { DayLegend } from "./DayLegend";
import styles from "./DayTimeline.module.css";
import { TechText } from "../../components/TechText";

interface Props {
  entries: EntryRef[];
  model: ArchModelV2;
  names: Map<string, string>;
  selected?: string;
  onSelect: (id: string) => void;
}

const DAY = 24 * 60;
const TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];
const pct = (minutes: number) => `${(minutes / DAY) * 100}%`;

/** Une journée : chaque tâche planifiée à ses heures lues dans le cron ; ce qui dépend d'une arrivée n'a pas d'horaire et le dit. */
export function DayTimeline({ entries, model, names, selected, onSelect }: Props) {
  return (
    <div className={styles.day}>
      <div className={styles.ticks} aria-hidden="true">
        {TICKS.map((h) => <span key={h} className={styles.tick} style={{ left: pct(h * 60) }}>{String(h).padStart(2, "0")}</span>)}
      </div>
      {entries.map((x) => {
        const { entry } = x;
        const runs = entry.kind === "schedule" ? dayRuns(entry.key) : undefined;
        const times = launchesOf(x, model)?.times;
        return (
          <button key={entry.id} type="button" className={`${styles.row} ${entry.id === selected ? styles.on : ""}`} aria-pressed={entry.id === selected} onClick={() => onSelect(entry.id)}>
            <span className={styles.label}>
              <span className={styles.name}>{entry.handler?.name ?? entry.key}</span>
              <span className={styles.when}><TechText text={whenLabel(entry, model, names)} /></span>
            </span>
            <span className={styles.track}>
              {TICKS.map((h) => <i key={h} className={h % 6 ? styles.dotted : styles.line} style={{ left: pct(h * 60) }} />)}
              {runs?.spans?.map(([a, b]) => <i key={a} className={styles.band} style={{ left: pct(a), width: pct(b - a) }} />)}
              {runs && !runs.every && runs.times.map((t) => (
                <i key={t} className={styles.mark} style={{ left: pct(t) }} title={clock(t)} />
              ))}
              {runs && !runs.every && times && <span className={styles.times} style={{ left: pct(runs.times[0]!) }}>×{times} exemplaires</span>}
              {runs?.every && times && <span className={styles.over}>×{times} exemplaires à chaque échéance</span>}
              {runs?.someDays && <span className={styles.over}>certains jours seulement</span>}
              {entry.kind === "schedule" && !runs && <span className={styles.none}>horaire non lu · {entry.key}</span>}
              {entry.kind !== "schedule" && <span className={styles.none}>pas d'horaire : à chaque arrivée</span>}
            </span>
          </button>
        );
      })}
      <DayLegend />
    </div>
  );
}
