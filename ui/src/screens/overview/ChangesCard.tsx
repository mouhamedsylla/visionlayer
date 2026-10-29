import type { MapPayload } from "../../api/types";
import { Pill } from "../../components/Pill";
import { ProofRef } from "../../components/ProofRef";
import { clockTime } from "../../domain/text/time";
import styles from "./ChangesCard.module.css";

const SHOWN = 8;

/** Ce qui est apparu ou a disparu depuis l'analyse précédente, gardée en mémoire par le serveur local. */
export function ChangesCard({ map }: { map: MapPayload }) {
  const changes = map.changes;
  const items = changes?.items ?? [];
  return (
    <div className={styles.card}>
      <Pill>Le système a changé</Pill>
      {!changes && (
        <p className={styles.note}>
          La comparaison commence à la prochaine mise à jour de l'analyse : l'analyse d'avant reste en mémoire, rien n'est écrit sur le disque.
        </p>
      )}
      {changes && items.length === 0 && <p className={styles.note}>Rien n'a changé depuis l'analyse de {clockTime(changes.since)}.</p>}
      {items.length > 0 && (
        <>
          <p className={styles.note}>Depuis l'analyse de {clockTime(changes!.since)} :</p>
          <ul className={styles.list}>
            {items.slice(0, SHOWN).map((c, i) => (
              <li key={i} className={styles.item}>
                <span className={c.sign === "added" ? styles.added : styles.removed}>{c.sign === "added" ? "+" : "−"}</span>
                <span>{c.text}</span>
                {c.proof && <ProofRef proof={c.proof} />}
              </li>
            ))}
          </ul>
          {items.length > SHOWN && <p className={styles.note}>et {items.length - SHOWN} autres changements</p>}
        </>
      )}
    </div>
  );
}
