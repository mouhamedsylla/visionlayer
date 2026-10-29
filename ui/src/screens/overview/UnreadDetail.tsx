import type { Coverage } from "../../api/types";
import { ProofRef } from "../../components/ProofRef";
import { count } from "../../domain/text/plural";
import styles from "./UnreadDetail.module.css";

const UNIT: Record<Coverage["unit"], string> = {
  files: "fichiers de code lus",
  manifests: "fichiers de déploiement lus",
  deployables: "déployables reconnus",
  calls: "appels résolus",
};

const GAP: Record<Coverage["gaps"][number]["kind"], string> = {
  language_not_read: "langage non lu",
  pack_missing: "sans pack",
  target_unknown: "cible inconnue",
  path_dynamic: "chemin calculé",
  manifest_unknown: "déploiement inconnu",
};

const gapsOf = (coverage: Coverage[]) => coverage.flatMap((c) => c.gaps);

/** `3 éléments non lus`, ou `Rien n'est signalé non lu`. */
export function unreadTitle(coverage: Coverage[]): string {
  const n = gapsOf(coverage).reduce((sum, g) => sum + g.count, 0);
  return n ? count(n, "élément non lu", "éléments non lus") : "Rien n'est signalé non lu";
}

/** Ce que l'analyse a lu, unité par unité, et chaque manque avec son premier endroit. */
export function UnreadDetail({ coverage }: { coverage: Coverage[] }) {
  const gaps = gapsOf(coverage);
  return (
    <div className={styles.detail}>
      <ul className={styles.meters}>
        {coverage.map((c) => (
          <li key={`${c.level}-${c.unit}`} className={styles.meter}>
            <span className={styles.value}>{c.read} / {c.total}</span>
            <span className={styles.label}>{UNIT[c.unit]}</span>
            <span className={styles.track} aria-hidden="true"><i style={{ width: `${c.total ? (100 * c.read) / c.total : 0}%` }} /></span>
          </li>
        ))}
      </ul>
      {gaps.length > 0 ? (
        <ul className={styles.gaps}>
          {gaps.map((g, i) => (
            <li key={i} className={styles.gap}>
              <span className={styles.tag}>{GAP[g.kind]}</span>
              <span>{g.subject}{g.count > 1 ? ` · ${g.count}` : ""}</span>
              {g.proof && <ProofRef proof={g.proof} />}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.note}>
          Aucun manque n'est signalé. Une forme qu'aucun pack ne connaît peut encore manquer : elle n'apparaîtrait ni ici ni sur la carte.
        </p>
      )}
    </div>
  );
}
