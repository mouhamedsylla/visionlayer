import type { MapPayload, ProjectInfo } from "../../api/types";
import { screenHref } from "../../app/screens";
import { Pill } from "../../components/Pill";
import { clockTime } from "../../domain/text/time";
import { HeroStats } from "./HeroStats";
import { MiniMap } from "./MiniMap";
import styles from "./OverviewHero.module.css";

interface Props {
  project: ProjectInfo;
  map: MapPayload;
  /** Les blocs du point ouvert plus bas, mis en avant sur la carte réduite. */
  marked: string[];
}

/** Le bandeau : le système tel qu'il tourne, sa carte réduite, et quatre compteurs qui mènent aux écrans. */
export function OverviewHero({ project, map, marked }: Props) {
  const elided = /^[aeiouyhâéèêîôû]/i.test(project.name);
  const name = <span className={styles.word}>{elided ? "d'" : ""}{project.name},</span>;
  const where = project.branch ? `sur ${project.branch}.` : "dans ce dossier.";
  return (
    <section className={styles.hero}>
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.tram} aria-hidden="true" />
      <div className={styles.top}>
        <div className={styles.text}>
          <Pill>Vue d'ensemble · {project.name}</Pill>
          <h1 className={styles.title}>
            <span className={styles.line}>Le système {!elided && "de "}{name}</span><br />
            <span className={styles.line}>tel qu'il tourne</span><br />
            <span className={styles.line}>{where}</span>
          </h1>
          <p className={styles.lead}>
            {project.lastChange && <>Dernier commit sur ce dossier <span className={styles.mono}>{project.lastChange.commit}</span> « {project.lastChange.subject} ». </>}
            Analysé à {clockTime(map.builtAt)}, chaque bloc et chaque lien renvoient à leur ligne.
          </p>
          <div className={styles.actions}>
            <a className={styles.open} href={screenHref("architecture")}>Ouvrir la carte du système →</a>
          </div>
          <p className={styles.note}>Local · lecture seule · n'écrit que dans .vision/, sur ton clic</p>
        </div>
        <div className={styles.map}><MiniMap model={map.model} tech={map.tech} marked={marked} /></div>
      </div>
      <HeroStats model={map.model} tech={map.tech} />
    </section>
  );
}
