import type { TechLabel } from "../../api/types";
import { TechLogo } from "../../components/TechLogo";
import type { FactVisual } from "../../domain/architecture/facts";
import styles from "./FactVisual.module.css";

/** La forme visuelle d'une case : chaque forme porte des chiffres de la carte, jamais une décoration. */
export function FactVisualView({ visual, tech }: { visual: FactVisual; tech: Record<string, TechLabel> }) {
  switch (visual.type) {
    case "logos":
      return (
        <ul className={styles.logos}>
          {visual.items.map((i) => (
            <li key={i.caption} className={styles.logo}>
              {i.tech ? <TechLogo id={i.tech} label={tech[i.tech]} size={22} /> : <span className={styles.noLogo} aria-hidden="true" />}
              <span>{i.caption}</span>
            </li>
          ))}
        </ul>
      );
    case "bar": {
      const total = visual.parts.reduce((n, p) => n + p.value, 0) || 1;
      return (
        <div className={styles.barWrap}>
          <div className={styles.bar} role="img" aria-label={visual.parts.map((p) => `${p.value} ${p.label}`).join(", ")}>
            {visual.parts.map((p) => <span key={p.label} className={styles[p.tone]} style={{ flexGrow: p.value / total }} />)}
          </div>
          <ul className={styles.legend}>
            {visual.parts.map((p) => <li key={p.label}><i className={styles[p.tone]} />{p.value} {p.label}</li>)}
          </ul>
        </div>
      );
    }
    case "list":
      return (
        <ul className={styles.list}>
          {visual.items.map((i) => <li key={i.label}><b className={styles.count}>{i.value}</b><span>{i.label}</span></li>)}
        </ul>
      );
    case "meter":
      return (
        <div className={styles.meter}>
          <div className={styles.track} role="meter" aria-valuemin={0} aria-valuemax={visual.total} aria-valuenow={visual.value} aria-label={visual.label}>
            <span style={{ width: `${visual.total ? (100 * visual.value) / visual.total : 0}%` }} />
          </div>
          <span className={styles.meterText}>{visual.value} sur {visual.total} {visual.label}</span>
        </div>
      );
  }
}
