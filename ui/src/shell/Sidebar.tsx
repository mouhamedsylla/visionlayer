import { Fragment } from "react";
import type { ArchModelV2 } from "../api/types";
import { SCREENS, screenHref, type ScreenEntry } from "../app/screens";
import { Icon } from "./icons";
import { Logo } from "./Logo";
import styles from "./Sidebar.module.css";

const GROUP_LABEL: Record<ScreenEntry["group"], string | undefined> = { comprendre: "Comprendre", suivre: "Suivre", bas: undefined };

interface Props {
  current: string;
  model: ArchModelV2;
  folded: boolean;
  onToggle: () => void;
}

function NavItem({ screen, current, folded, model }: { screen: ScreenEntry; current: string; folded: boolean; model: ArchModelV2 }) {
  // réduite, le nom reste dans la page (invisible) : il sert d'info-bulle et de nom lu
  const label = folded ? screen.label : undefined;
  if (!screen.component) {
    return (
      <span className={`${styles.item} ${styles.pending}`} aria-disabled="true" aria-label={label} title={`${screen.label} : pas encore recodé`}>
        <Icon name={screen.icon} />
        <span className={styles.label}>{screen.label}</span>
      </span>
    );
  }
  const active = screen.id === current;
  const unread = screen.unread?.(model);
  return (
    <a className={`${styles.item} ${active ? styles.active : ""} ${unread ? styles.pending : ""}`} href={screenHref(screen.id)} aria-current={active ? "page" : undefined}
      aria-label={label} title={unread ? `${screen.label} : ${unread}` : label}>
      <Icon name={screen.icon} />
      <span className={styles.label}>{screen.label}</span>
    </a>
  );
}

export function Sidebar({ current, model, folded, onToggle }: Props) {
  return (
    <nav className={`${styles.nav} ${folded ? styles.folded : ""}`} aria-label="Navigation">
      <div className={styles.brand}>
        <Logo />
        <span className={styles.label}>VisionLayer</span>
      </div>
      {SCREENS.map((screen, i) => {
        const opens = screen.group !== SCREENS[i - 1]?.group;
        const heading = GROUP_LABEL[screen.group];
        return (
          <Fragment key={screen.id}>
            {opens && screen.group === "bas" && <div className={styles.spacer} />}
            {opens && heading && <div className={styles.group}><span className={styles.label}>{heading}</span></div>}
            <NavItem screen={screen} current={current} folded={folded} model={model} />
          </Fragment>
        );
      })}
      <button type="button" className={styles.fold} onClick={onToggle} aria-label={folded ? "Ouvrir la barre latérale" : undefined}>
        <Icon name={folded ? "expand" : "collapse"} />
        <span className={styles.label}>Réduire la barre</span>
      </button>
    </nav>
  );
}
