import type { MapPayload } from "../../api/types";
import { Pill } from "../../components/Pill";
import type { PointRow } from "../../domain/overview/points";
import { count } from "../../domain/text/plural";
import { PointDetail } from "./PointDetail";
import { PointList } from "./PointList";
import { UnreadDetail, unreadTitle } from "./UnreadDetail";
import styles from "./KnowSection.module.css";

export type KnowTab = "points" | "unread";

interface Props {
  map: MapPayload;
  rows: PointRow[];
  selected: number;
  onSelect: (index: number) => void;
  tab: KnowTab;
  onTab: (tab: KnowTab) => void;
}

/** « Ce qu'il faut savoir » : à gauche, les questions en accordéon ; à droite, le point ouvert, dessiné. */
export function KnowSection({ map, rows, selected, onSelect, tab, onTab }: Props) {
  const total = map.model.findings.length;
  const row = rows[selected];
  const head = (id: KnowTab, label: string) => (
    <button type="button" className={`${styles.question} ${tab === id ? styles.on : ""}`} aria-expanded={tab === id} onClick={() => onTab(id)}>
      <span>{label}</span>
    </button>
  );
  return (
    <section className={styles.section}>
      <Pill>Ce qu'il faut savoir</Pill>
      <div className={styles.grid}>
        <div className={styles.accordion}>
          {head("points", total ? count(total, "point à vérifier", "points à vérifier") : "Aucun point relevé")}
          {tab === "points" && (
            <div className={styles.panel}>
              <p className={styles.hint}>Chaque point renvoie à sa ligne. Ce que VisionLayer ne sait pas prouver, il le dit.</p>
              {rows.length > 0 ? <PointList rows={rows} selected={selected} onSelect={onSelect} /> : <p className={styles.hint}>Les packs n'ont rien relevé sur ce dépôt.</p>}
            </div>
          )}
          {head("unread", unreadTitle(map.model.coverage))}
        </div>
        <div className={styles.detail}>
          {tab === "points" && row && <PointDetail key={row.code} row={row} map={map} />}
          {tab === "unread" && <UnreadDetail coverage={map.model.coverage} />}
        </div>
      </div>
    </section>
  );
}
