import type { TechLabel } from "../../api/types";
import { Breakable } from "../../components/Breakable";
import { TechLogo } from "../../components/TechLogo";
import { kindLabel, primaryTechId } from "../../domain/architecture/describe";
import type { FnTree } from "../../domain/code/functions";
import { count } from "../../domain/text/plural";
import { FunctionRow } from "./FunctionRow";
import styles from "./FunctionBlock.module.css";

interface Props {
  block: FnTree[number];
  tech: Record<string, TechLabel>;
  names: Map<string, string>;
  open: boolean;
  onToggle: () => void;
}

/** Un bloc et ses fichiers, repliable : un gros dépôt ne s'affiche pas d'un coup, chaque bloc dit combien il en garde. */
export function FunctionBlock({ block: { node, files }, tech, names, open, onToggle }: Props) {
  const logo = primaryTechId(node, tech) ?? node.tech?.[0];
  const total = files.reduce((m, f) => m + f.fns.length, 0);
  return (
    <section className={`${styles.block} ${open ? styles.open : ""}`}>
      <h3 className={styles.heading}>
        <button type="button" className={styles.toggle} aria-expanded={open} onClick={onToggle}>
          {logo && <TechLogo id={logo} label={tech[logo]} size={22} />}
          <span className={styles.name}>{node.name}</span>
          <span className={styles.kind}>{kindLabel(node, tech)} · {count(total, "fonction")} · {count(files.length, "fichier")}</span>
          <i className={styles.chevron} aria-hidden="true" />
        </button>
      </h3>
      {open && files.map((f) => (
        <div key={f.path} className={styles.file}>
          <div className={styles.path}><Breakable text={f.path} /></div>
          <ul className={styles.rows}>{f.fns.map((fn) => <FunctionRow key={fn.id} fn={fn} node={node} names={names} />)}</ul>
        </div>
      ))}
    </section>
  );
}
