import { Icon } from "../shell/icons";
import styles from "./PanelFold.module.css";

/** Replier le panneau de droite ; replié, son nom se lit de haut en bas sur le rail, et un clic le rouvre. */
export function PanelFold({ label, folded, onToggle }: { label: string; folded: boolean; onToggle: () => void }) {
  return (
    <>
      <button type="button" className={`${styles.fold} ${folded ? styles.folded : ""}`} onClick={onToggle} aria-expanded={!folded}
        title={folded ? `Ouvrir le panneau · ${label}` : "Replier le panneau"} aria-label={folded ? `Ouvrir le panneau : ${label}` : "Replier le panneau"}>
        <Icon name={folded ? "collapse" : "expand"} size={15} />
      </button>
      <button type="button" className={`${styles.rail} ${folded ? styles.folded : ""}`} onClick={onToggle} tabIndex={-1} aria-hidden="true">{label}</button>
    </>
  );
}
