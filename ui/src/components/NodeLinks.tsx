import type { ArchNode, TechLabel } from "../api/types";
import { TechLogo } from "./TechLogo";
import { primaryTechId } from "../domain/architecture/describe";
import type { MapLink } from "../domain/architecture/links";
import styles from "./NodeLinks.module.css";

interface Props {
  title: string;
  links: MapLink[];
  other: (l: MapLink) => string;
  nodes: ArchNode[];
  tech: Record<string, TechLabel>;
  label: (l: MapLink) => string;
}

/** Les liens d'un bloc dans un sens : le bloc d'en face, son logo, et ce qui passe, nature par nature. */
export function NodeLinks({ title, links, other, nodes, tech, label }: Props) {
  if (!links.length) return null;
  return (
    <section>
      <h3 className={styles.heading}>{title} · {links.length}</h3>
      <ul className={styles.links}>
        {links.map((l) => {
          const n = nodes.find((x) => x.id === other(l));
          const t = n && (primaryTechId(n, tech) ?? n.tech?.[0]);
          return (
            <li key={l.id}>
              {t ? <TechLogo id={t} label={tech[t]} size={22} /> : <span className={styles.noLogo} />}
              <b>{n?.name ?? other(l)}</b>
              <span className={styles.chips}>{label(l).split(" · ").map((c) => <span key={c} className={styles.chip}>{c}</span>)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
