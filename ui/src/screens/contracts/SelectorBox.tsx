import type { ArchModelV2 } from "../../api/types";
import { ProofRef } from "../../components/ProofRef";
import { selectorEnv, type ContractRef } from "../../domain/contracts/list";
import styles from "./SelectorBox.module.css";

/** La fonction qui choisit l'implémentation : quelle valeur mène à quelle classe, et les variables qu'elle lit, noms seulement. */
export function SelectorBox({ subject, model }: { subject: ContractRef; model: ArchModelV2 }) {
  const { contract } = subject;
  if (!contract.selector) return null;
  const choices = contract.selector.choices ?? [];
  const env = selectorEnv(subject, model);
  return (
    <section className={styles.box}>
      <h2 className={styles.heading}>Qui choisit · <code>{contract.selector.symbol.name}()</code><ProofRef proof={contract.selector.symbol} /></h2>
      {choices.length > 0 && (
        <table className={styles.table}>
          <thead><tr><th>valeur lue</th><th>implémentation</th><th>ligne</th></tr></thead>
          <tbody>
            {choices.map((c) => (
              <tr key={`${c.implementation}-${c.when ?? ""}`}>
                <td>{c.when ? <code>{c.when}</code> : <span className={styles.soft}>{choices.length > 1 ? "sinon" : "toujours"}</span>}</td>
                <td className={styles.mono}>{c.implementation}</td>
                <td><ProofRef proof={c.proof} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {env.length > 0 && (
        <>
          <p className={styles.note}>Variables lues par {contract.selector.symbol.name} : noms seulement, jamais les valeurs.</p>
          <table className={styles.table}>
            <thead><tr><th>variable</th><th>selon le code</th><th>lue à</th></tr></thead>
            <tbody>
              {env.map((v) => (
                <tr key={v.name}>
                  <td className={styles.mono}>{v.name}</td>
                  <td className={styles.soft}>{v.required === false ? "facultative" : v.required ? "requise" : "le code ne dit pas"}</td>
                  <td className={styles.refs}>{v.at.map((p) => <ProofRef key={`${p.path}:${p.line}`} proof={p} />)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
