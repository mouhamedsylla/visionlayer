import type { ReactNode } from "react";
import { PanelFold } from "./PanelFold";
import { useStoredFlag } from "./useStoredFlag";
import styles from "./SidePanel.module.css";

export { PanelSection } from "./PanelSection";

/**
 * Le panneau de droite d'un écran : il reste à côté du contenu quand on
 * descend, avec son propre défilement, et passe sous le contenu quand l'écran
 * est étroit. Il se replie en un rail fin pour laisser la place au contenu ;
 * ce choix vaut pour tous les écrans de ce navigateur. Son contenu entre en
 * fondu quand on change d'élément.
 */
export function SidePanel({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  const [folded, toggle] = useStoredFlag("vision.panel.folded");
  return (
    <aside className={`${styles.panel} ${wide ? styles.wide : ""} ${folded ? styles.folded : ""}`} aria-label={label}>
      <PanelFold label={label} folded={folded} onToggle={toggle} />
      <div className={styles.scroll} inert={folded}>
        <div key={label} className={styles.inner}>{children}</div>
      </div>
    </aside>
  );
}

/** Une ligne du panneau : le fait à gauche, la ligne qui le prouve à droite, puis ce qui l'explique. */
export function PanelItem({ title, children }: { title?: ReactNode; children?: ReactNode }) {
  return (
    <div className={styles.item}>
      {title && <b className={styles.itemTitle}>{title}</b>}
      {children}
    </div>
  );
}

export function PanelNote({ children }: { children: ReactNode }) {
  return <p className={styles.note}>{children}</p>;
}

export function PanelBack({ href, onClick, children }: { href?: string; onClick?: () => void; children: ReactNode }) {
  return href
    ? <a className={styles.close} href={href}>{children}</a>
    : <button type="button" className={styles.close} onClick={onClick}>{children}</button>;
}

export function PanelTitle({ kind, title, origin }: { kind: string; title: string; origin?: ReactNode }) {
  return (
    <div className={styles.titleBlock}>
      <span className={styles.kind}>{kind}</span>
      <h2 className={styles.title}>{title}</h2>
      {origin && <span className={styles.origin}>{origin}</span>}
    </div>
  );
}

export function PanelAction({ href, children }: { href: string; children: ReactNode }) {
  return <a className={styles.enter} href={href}>{children}</a>;
}
