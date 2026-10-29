import type { ArchNode } from "../../api/types";
import { screenHref } from "../../app/screens";
import styles from "./StoreTabs.module.css";

/** Un onglet par stockage quand la carte en a plusieurs. */
export function StoreTabs({ stores, current }: { stores: ArchNode[]; current: string }) {
  return (
    <nav className={styles.tabs} aria-label="Stockages">
      {stores.map((s) => (
        <a key={s.id} href={screenHref("donnees", s.id)} className={`${styles.tab} ${s.id === current ? styles.current : ""}`} aria-current={s.id === current ? "page" : undefined}>
          {s.name}
        </a>
      ))}
    </nav>
  );
}
