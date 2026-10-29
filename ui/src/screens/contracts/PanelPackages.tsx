import type { ContractFacet, Proof, TechLabel } from "../../api/types";
import { ProofRef } from "../../components/ProofRef";
import { TechLogo } from "../../components/TechLogo";
import styles from "./PanelPackages.module.css";

/** Les paquets des fournisseurs, avec leur logo : importés seulement dans le module, ou aussi ailleurs (et où). */
export function PanelPackages({ sealed, tech }: { sealed: NonNullable<ContractFacet["sealed"]>; tech: Record<string, TechLabel> }) {
  return (
    <ul className={styles.list}>
      {sealed.packages.map((p) => {
        const out: Proof[] = sealed.leaks.filter((l) => l.text?.includes(p));
        return (
          <li key={p} className={`${styles.pkg} ${out.length ? styles.leak : ""}`}>
            <TechLogo id={p} label={tech[p]} size={28} />
            <span className={styles.text}>
              <b>{tech[p]?.name ?? p}</b>
              <span>{out.length ? `aussi importé ailleurs, ${out.length} fois` : "importé seulement ici"}</span>
            </span>
            {out[0] ? <ProofRef proof={out[0]} /> : <i className={styles.ok} aria-label="la règle tient" />}
          </li>
        );
      })}
    </ul>
  );
}
