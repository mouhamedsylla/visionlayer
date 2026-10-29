import type { TechLabel } from "../api/types";
import styles from "./TechLogo.module.css";

interface Props {
  id: string;
  label?: TechLabel;
  /** Côté de la tuile, en pixels. */
  size?: number;
  /** Sans tuile : le logo seul, pour une rangée de petites marques. */
  bare?: boolean;
}

/** Le logo d'une technologie (Simple Icons, d'une seule couleur), ou ses deux premières lettres quand la marque n'en a pas. */
export function TechLogo({ id, label, size = 24, bare = false }: Props) {
  const name = label?.name ?? id;
  const glyph = Math.round(size * (bare ? 1 : 0.62));
  return (
    <span className={bare ? styles.bare : styles.tile} style={{ width: size, height: size }} title={name} role="img" aria-label={name}>
      {label?.icon ? (
        <svg width={glyph} height={glyph} viewBox="0 0 24 24" aria-hidden="true"><path d={label.icon} /></svg>
      ) : (
        <span className={styles.mono} style={{ fontSize: Math.max(8, Math.round(size * 0.36)) }}>{name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}
