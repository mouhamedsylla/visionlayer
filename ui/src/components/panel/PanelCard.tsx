import type { ReactNode } from "react";
import type { Proof } from "../../api/types";
import { ProofRef } from "../ProofRef";
import styles from "./PanelCard.module.css";

interface Props {
  /** Le logo de la technologie, ou l'icône de la nature. */
  mark?: ReactNode;
  kind?: ReactNode;
  title: ReactNode;
  href?: string;
  /** Ce qu'il fait, en pastilles courtes : `lit 3 tables`, `écrit 1 table`. */
  chips?: ReactNode[];
  proof?: Pick<Proof, "path" | "line"> & Partial<Proof>;
  children?: ReactNode;
}

/** Un élément du système dans le panneau, en carte : sa marque, ce qu'il est, son nom, ce qu'il fait, sa ligne. */
export function PanelCard({ mark, kind, title, href, chips = [], proof, children }: Props) {
  const name = href ? <a className={styles.link} href={href}>{title}</a> : title;
  return (
    <div className={`${styles.card} ${mark ? "" : styles.plain}`}>
      {mark && <span className={styles.mark}>{mark}</span>}
      <span className={styles.text}>
        {kind && <span className={styles.kind}>{kind}</span>}
        <b className={styles.title}>{name}</b>
      </span>
      {proof && <ProofRef proof={proof} />}
      {chips.length > 0 && <span className={styles.chips}>{chips.map((c, i) => <span key={i} className={styles.chip}>{c}</span>)}</span>}
      {children && <div className={styles.more}>{children}</div>}
    </div>
  );
}

