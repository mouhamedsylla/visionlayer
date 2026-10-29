import { screenHref } from "../../app/screens";
import { ProofRef } from "../../components/ProofRef";
import { entryNature } from "../../domain/block/entries";
import type { ContractUser } from "../../domain/contracts/list";
import { isBackground } from "../../domain/messages/triggers";
import styles from "./UsersView.module.css";

/** Les points d'entrée qui finissent par employer le contrat : celui qui l'appelle, et ceux qui lui envoient du travail. */
export function UsersView({ users }: { users: ContractUser[] }) {
  if (!users.length) return <p className={styles.empty}>Aucun point d'entrée lu n'atteint ce contrat.</p>;
  return (
    <section className={styles.box}>
      <table className={styles.table}>
        <colgroup><col className={styles.colEntry} /><col className={styles.colNature} /><col /><col className={styles.colProof} /></colgroup>
        <thead><tr><th>point d'entrée</th><th>nature</th><th>comment il y arrive</th><th>ligne</th></tr></thead>
        <tbody>
          {users.map(({ item, how, proof }) => (
            <tr key={item.entry.id}>
              <td>
                <a className={styles.entry} href={screenHref(isBackground(item.entry) ? "messages" : "features", item.entry.id)}>{item.entry.handler?.name ?? item.entry.key}</a>
                <span className={styles.key}>{item.entry.key}</span>
              </td>
              <td><span className={styles.nature}>{entryNature(item.entry)}</span></td>
              <td>{how}</td>
              <td><ProofRef proof={proof} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
