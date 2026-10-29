import type { SourceExcerpt } from "../api/types";
import { codeTokens } from "../domain/text/codeTokens";
import { proofLabel } from "../domain/text/proof";
import styles from "./CodeExcerpt.module.css";

interface Props {
  excerpt: SourceExcerpt;
  /** Lignes mises en avant, par leur numéro dans le fichier. */
  marks?: number[];
  /** Ce que disent les lignes en avant : `contrôles`. */
  marksLabel?: string;
  /** Un numéro dans la marge, par ligne : l'étape du déroulé qu'elle porte. */
  badges?: Map<number, number>;
  /** La ligne choisie, mise en vue dans le passage quand elle change. */
  focus?: number;
}

/** Un passage du code tel qu'il est écrit, sur fond nuit comme dans les maquettes, avec ses numéros de ligne. */
export function CodeExcerpt({ excerpt, marks = [], marksLabel, badges, focus }: Props) {
  const lines = codeTokens(excerpt.lines);
  return (
    <figure className={styles.code}>
      <figcaption className={styles.head}>
        <span title={excerpt.path}>{proofLabel({ path: excerpt.path, line: excerpt.from })}</span>
        {marks.length > 0 && marksLabel && <span className={styles.legend}><i className={styles.swatch} />{marksLabel}</span>}
      </figcaption>
      <pre className={styles.body}>
        {lines.map((tokens, i) => {
          const n = excerpt.from + i;
          return (
            <div key={n} className={`${styles.line} ${marks.includes(n) ? styles.marked : ""}`}>
              <span className={styles.number}>{n}</span>
              {badges && <span className={styles.badge}>{badges.has(n) && <b data-focus={n === focus || undefined}>{badges.get(n)}</b>}</span>}
              <code>{tokens.length ? tokens.map((t, j) => <span key={j} className={styles[t.tone]}>{t.text}</span>) : " "}</code>
            </div>
          );
        })}
      </pre>
    </figure>
  );
}
