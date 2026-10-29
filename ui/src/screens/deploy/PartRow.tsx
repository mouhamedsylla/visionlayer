import type { TechLabel } from "../../api/types";
import { screenHref } from "../../app/screens";
import { TechLogo } from "../../components/TechLogo";
import { kindLabel, primaryTechId } from "../../domain/architecture/describe";
import type { DeployPart } from "../../domain/deploy/parts";
import styles from "./PartRow.module.css";

/** Une partie du système : ce qu'elle est, les manifestes qui la déclarent, combien et où ; sans manifeste, elle le dit. */
export function PartRow({ part, tech, on }: { part: DeployPart; tech: Record<string, TechLabel>; on: boolean }) {
  const { node, declared } = part;
  const logo = primaryTechId(node, tech);
  const region = node.attributes?.find((a) => a.key === "region");
  return (
    <a className={`${styles.row} ${on ? styles.on : ""} ${declared.length ? "" : styles.bare}`} href={screenHref("deploiement", node.id)} aria-current={on ? "true" : undefined}>
      <span className={styles.who}>
        {logo ? <TechLogo id={logo} label={tech[logo]} size={28} /> : <span className={styles.blank} />}
        <span className={styles.names}>
          <b className={styles.name}>{node.name}</b>
          <span className={styles.kind}>{kindLabel(node, tech)}</span>
        </span>
      </span>
      <span className={styles.where}>
        {declared.length ? declared.map((d) => (
          <span key={`${d.pack}-${d.proof.path}`} className={styles.decl}>
            {d.tech && <TechLogo id={d.tech} label={tech[d.tech]} size={16} bare />}
            {d.name}<span className={styles.path}>{d.proof.path}:{d.proof.line}</span>
          </span>
        )) : (
          <span className={styles.none}>
            aucun fichier de déploiement ne dit où il tourne
            {part.seenIn[0] && <> · trouvé par {part.seenIn[0].name.toLowerCase()} <span className={styles.path}>{part.seenIn[0].proof.path}:{part.seenIn[0].proof.line}</span></>}
            {part.readVia[0] && <> · seul <code>{part.readVia[0].name}</code> est lu dans le code</>}
          </span>
        )}
      </span>
      <span className={styles.facts}>
        {node.instances && <span>×{node.instances.min} au minimum</span>}
        {region && <span>région {region.value}</span>}
        <span className={declared.length ? styles.ok : styles.todo}>{declared.length ? "déclaré" : "hébergement non déclaré"}</span>
      </span>
    </a>
  );
}
