import type { TechLabel } from "../../api/types";
import { screenHref } from "../../app/screens";
import { Breakable } from "../../components/Breakable";
import { TechLogo } from "../../components/TechLogo";
import type { TechTile } from "../../domain/technologies/groups";
import styles from "./TechTileLink.module.css";

/** Une technologie en tuile : son logo, son nom et ses versions, l'endroit qui la déclare. Un clic l'ouvre dans le panneau. */
export function TechTileLink({ tile, label, on }: { tile: TechTile; label?: TechLabel; on: boolean }) {
  return (
    <a className={`${styles.tile} ${on ? styles.on : ""} ${tile.external ? styles.external : ""}`} href={screenHref("technologies", tile.id)} aria-current={on ? "true" : undefined}>
      <TechLogo id={tile.id} label={label} size={30} />
      <span className={styles.text}>
        <span className={styles.name}>{tile.name}{tile.version && <span className={styles.version}>{tile.version}</span>}</span>
        {tile.where && <span className={styles.where}><Breakable text={tile.where} /></span>}
      </span>
    </a>
  );
}
