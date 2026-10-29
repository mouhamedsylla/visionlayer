import type { ReactNode } from "react";
import { useStickyHeader } from "./useStickyHeader";
import styles from "./ScreenHeader.module.css";

export interface Crumb {
  label: string;
  href?: string;
}

interface Props {
  crumbs: Crumb[];
  title: string;
  lead?: ReactNode;
  children?: ReactNode;
  /** Ce qui se pose en haut à droite : `À savoir`, des onglets. */
  aside?: ReactNode;
}

/**
 * Le bandeau en haut de chaque écran : fil d'Ariane, titre surligné, puis ce que l'écran résume.
 * Il reste en haut quand on descend, resserré au titre et à ce qui est à droite.
 */
export function ScreenHeader({ crumbs, title, lead, children, aside }: Props) {
  const { ref, condensed } = useStickyHeader<HTMLElement>();
  return (
    <section ref={ref} className={`${styles.header} ${condensed ? styles.condensed : ""}`}>
      <div className={styles.main}>
        <nav className={styles.crumb} aria-label="Fil d'Ariane">
          {crumbs.map((c, i) => (
            <span key={`${c.label}-${i}`} className={styles.step}>
              {i > 0 && <span aria-hidden="true">›</span>}
              {c.href ? <a className={styles.link} href={c.href}>{c.label}</a> : <span>{c.label}</span>}
            </span>
          ))}
        </nav>
        <h1 className={styles.title}>{title}</h1>
        {(lead || children) && (
          <div className={styles.fold} inert={condensed}>
            <div className={styles.foldInner}>
              {lead && <div className={styles.lead}>{lead}</div>}
              {children}
            </div>
          </div>
        )}
      </div>
      {aside && <div className={styles.aside}>{aside}</div>}
    </section>
  );
}
