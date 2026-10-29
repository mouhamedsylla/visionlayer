import { Icon, type IconName } from "../shell/icons";
import styles from "./ViewTabs.module.css";

export interface ViewTab {
  id: string;
  label: string;
  icon: IconName;
  count?: number;
}

/** Les vues d'un élément, chacune une adresse : `Cycle de vie`, `Forme 11`, `Accès 2` ; `Tracé`, `Code`. */
export function ViewTabs({ tabs, current, href, label }: { tabs: ViewTab[]; current: string; href: (id: string) => string; label: string }) {
  return (
    <nav className={styles.tabs} aria-label={label}>
      {tabs.map((t) => (
        <a key={t.id} href={href(t.id)} className={`${styles.tab} ${t.id === current ? styles.on : ""}`} aria-current={t.id === current ? "page" : undefined}>
          <Icon name={t.icon} size={14} />{t.label}{t.count !== undefined && <span className={styles.count}>{t.count}</span>}
        </a>
      ))}
    </nav>
  );
}
