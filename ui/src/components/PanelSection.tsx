import { Children, useState, type ReactNode } from "react";
import { splitCount } from "../domain/text/count";
import styles from "./PanelSection.module.css";

const SHOWN = 5;

/**
 * Une section du panneau, repliable : son titre, son compte à part (`Parle à · 3`
 * donne « Parle à » et 3), puis ses lignes. Au-delà de cinq lignes, les autres
 * attendent un clic : un gros système ne noie pas le panneau.
 */
export function PanelSection({ title, empty, children, open: initial = true }: { title: string; empty?: string; children?: ReactNode; open?: boolean }) {
  const items = Children.toArray(children);
  const [open, setOpen] = useState(initial);
  const [all, setAll] = useState(false);
  const { label, count } = splitCount(title);
  const hidden = items.length - SHOWN;
  return (
    <section className={`${styles.section} ${open ? styles.open : ""}`}>
      <h3 className={styles.heading}>
        <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className={styles.label}>{label}</span>
          {count && <span className={styles.count}>{count}</span>}
          <i className={styles.chevron} aria-hidden="true" />
        </button>
      </h3>
      <div className={styles.fold} inert={!open}>
        <div className={styles.foldInner}>
          {items.length ? (all || hidden <= 1 ? items : items.slice(0, SHOWN)) : empty && <p className={styles.empty}>{empty}</p>}
          {hidden > 1 && (
            <button type="button" className={styles.more} onClick={() => setAll((a) => !a)}>
              {all ? "Montrer moins" : `Voir les ${hidden} autres`}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
