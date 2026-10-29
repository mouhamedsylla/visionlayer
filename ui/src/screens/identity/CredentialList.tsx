import { screenHref } from "../../app/screens";
import { Chip } from "../../components/Chip";
import { ProofRef } from "../../components/ProofRef";
import { RouteMethod, RoutePath } from "../../components/RouteKey";
import type { CredentialStore } from "../../domain/identity/credentials";
import { LEVEL_LABEL } from "../../domain/identity/facts";
import { cronLabel } from "../../domain/text/cron";
import { joinWords } from "../../domain/text/plural";
import styles from "./CredentialList.module.css";

/** Ce que la garde lit pour reconnaître l'appelant, et chaque point d'entrée qui l'écrit : le cycle de vie de la preuve. */
export function CredentialList({ stores, names }: { stores: CredentialStore[]; names: Map<string, string> }) {
  if (!stores.length) return <p className={styles.none}>La garde ne lit rien que le moteur reconnaisse : elle vérifie peut-être un jeton signé, sans stockage.</p>;
  return (
    <div className={styles.list}>
      {stores.map((s) => (
        <article key={`${s.node}:${s.entity}`} className={styles.store}>
          <header className={styles.head}>
            <code className={styles.entity}>{s.entity}</code>
            <span className={styles.where}>{names.get(s.node) ?? s.node}</span>
            <span className={styles.by}>lue par {joinWords(s.readBy.map((g) => `${g.ref.name}()`))}</span>
          </header>
          {s.writes.length ? (
            <ul className={styles.writes}>
              {s.writes.map((w) => {
                const e = w.item.entry;
                return (
                  <li key={e.id}>
                    <a href={screenHref("features", e.id)} className={styles.entry}>
                      {e.kind === "http" ? <><RouteMethod routeKey={e.key} /><RoutePath routeKey={e.key} inline /></> : <Chip>{e.kind === "schedule" ? cronLabel(e.key) : e.key}</Chip>}
                    </a>
                    {e.access && <Chip tone={e.access.level === "public" ? "missing" : "plain"}>{LEVEL_LABEL[e.access.level].short}</Chip>}
                    {w.fn && <span className={styles.fn}>par <code>{w.fn}()</code></span>}
                    {w.proof.text && <code className={styles.line}>{w.proof.text}</code>}
                    <ProofRef proof={w.proof} />
                  </li>
                );
              })}
            </ul>
          ) : <p className={styles.none}>Aucun point d'entrée lu ne l'écrit.</p>}
        </article>
      ))}
    </div>
  );
}
