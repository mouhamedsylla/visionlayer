import type { Entrypoint } from "../../api/types";
import { reachOf } from "../../domain/features/list";
import { TechMark } from "../TechText";
import styles from "./PanelReach.module.css";

/** Ce qu'un point d'entrée touche, d'après son déroulé : chaque table, file et service avec sa marque, comme dans les phrases. */
export function PanelReach({ entry, names }: { entry: Entrypoint; names: Map<string, string> }) {
  const { tables, topics, services } = reachOf(entry, names);
  const pieces = [
    ...tables.map((text) => ({ text, kind: "table" as const })),
    ...topics.map((text) => ({ text, kind: "queue" as const })),
    ...services.map((text) => ({ text, kind: "block" as const })),
  ];
  return <div className={styles.reach}>{pieces.map((p) => <TechMark key={`${p.kind}:${p.text}`} piece={p} />)}</div>;
}

export function reachCount(entry: Entrypoint, names: Map<string, string>): number {
  const r = reachOf(entry, names);
  return r.tables.length + r.topics.length + r.services.length;
}
