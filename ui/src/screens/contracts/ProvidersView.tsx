import type { ArchModelV2 } from "../../api/types";
import { ProofRef } from "../../components/ProofRef";
import type { ContractRef } from "../../domain/contracts/list";
import { SelectorBox } from "./SelectorBox";
import styles from "./ProvidersView.module.css";

/** Chaque implémentation, ce qu'elle appelle chez le fournisseur et quand elle est choisie ; puis la fonction qui choisit et ce qu'elle lit. */
export function ProvidersView({ subject, model }: { subject: ContractRef; model: ArchModelV2 }) {
  const { contract } = subject;
  const choices = contract.selector?.choices ?? [];
  return (
    <>
      <h2 className={styles.title}>Qui tient le contrat<span className={styles.count}>{contract.implementations.length} implémentations</span></h2>
      <div className={styles.cards}>
        {contract.implementations.map((i) => {
          const choice = choices.find((c) => c.implementation === i.name);
          return (
            <article key={i.name} className={styles.card}>
              <header className={styles.cardHead}>
                <b className={styles.name}>{i.name}</b>
                <ProofRef proof={i} />
              </header>
              <p className={styles.when}>
                {!choice ? "aucun choix lu ne la retient" : choice.when ? <>choisie pour <code>{choice.when}</code></> : choices.length > 1 ? "choisie quand aucun autre cas ne répond" : "choisie"}
              </p>
              <ul className={styles.calls}>
                {(i.calls ?? []).map((c) => <li key={c.name}><code>{c.name}</code><ProofRef proof={c.proof} /></li>)}
                {!i.calls?.length && <li className={styles.none}>aucun appel hors de la classe lu</li>}
              </ul>
              <footer className={styles.foot}>
                {i.packages?.length ? <span>paquet {i.packages.join(", ")}</span> : <span className={styles.none}>aucun paquet externe</span>}
                {i.returns?.length ? <span>rend la main à {i.returns.length} endroit{i.returns.length > 1 ? "s" : ""}</span> : null}
              </footer>
            </article>
          );
        })}
      </div>

      <SelectorBox subject={subject} model={model} />
    </>
  );
}
