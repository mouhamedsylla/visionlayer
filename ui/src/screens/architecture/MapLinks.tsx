import { linkGeometry } from "../../domain/architecture/geometry";
import type { MapLayout } from "../../domain/architecture/layout";
import { linkLabel, type MapLink } from "../../domain/architecture/links";
import styles from "./MapLinks.module.css";

interface Props {
  links: MapLink[];
  layout: MapLayout;
  selected?: string;
}

/** Les traits entre blocs ; ceux du bloc choisi passent en bleu plein et disent ce qu'ils portent. */
export function MapLinks({ links, layout, selected }: Props) {
  const ids = new Set(links.map((l) => l.id));
  const drawn = links.flatMap((link) => {
    const a = layout.placed.get(link.from);
    const b = layout.placed.get(link.to);
    if (!a || !b) return [];
    const offset = ids.has(`${link.to}->${link.from}`) ? (link.from < link.to ? -10 : 10) : 0;
    const active = !!selected && (link.from === selected || link.to === selected);
    return [{ link, active, geometry: linkGeometry(a, b, offset) }];
  });
  const state = (active: boolean) => (active ? styles.active : selected ? styles.faded : "");

  return (
    <>
      <svg className={styles.svg} width={layout.width} height={layout.height} aria-hidden="true">
        <defs>
          <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L8 4L0 8z" fill="context-stroke" />
          </marker>
        </defs>
        {drawn.map(({ link, active, geometry }) => (
          <path key={link.id} d={geometry.d} className={`${styles.link} ${state(active)}`} markerEnd="url(#arrow)" />
        ))}
      </svg>
      {drawn.filter((d) => d.active).map(({ link, geometry }) => {
        // Près du bloc d'en face : deux blocs reliés au bloc choisi n'ont jamais leurs étiquettes au même endroit.
        const [left, top] = geometry.at(link.from === selected ? 0.8 : 0.2);
        return (
          <span key={link.id} className={styles.label} style={{ left, top }}>
            {linkLabel(link)}
          </span>
        );
      })}
    </>
  );
}
