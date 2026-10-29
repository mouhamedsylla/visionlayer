import type { ArchModelV2 } from "../../api/types";
import { screenHref } from "../../app/screens";
import { ProofRef } from "../../components/ProofRef";
import { RouteMethod, RoutePath } from "../../components/RouteKey";
import { entryNature, isUncalled, triggeredBy } from "../../domain/block/entries";
import { reachOf, refusalsOf, type EntryRef } from "../../domain/features/list";
import { count } from "../../domain/text/plural";
import styles from "./FeatureRow.module.css";

interface Props {
  item: EntryRef;
  model: ArchModelV2;
  names: Map<string, string>;
}

/** Un point d'entrée sans feature : ce qui le lance, qui le déclenche, ce qu'il atteint, combien de fois il refuse. Un clic ouvre son déroulé. */
export function FeatureRow({ item: { entry }, model, names }: Props) {
  const reach = reachOf(entry, names);
  const refusals = refusalsOf(entry);
  const by = triggeredBy(entry, names, model);
  const steps = entry.flow?.length ?? 0;
  return (
    <li>
      <a className={styles.row} href={screenHref("features", entry.id)}>
        {entry.kind === "http" ? <RouteMethod routeKey={entry.key} /> : <span className={styles.nature}>{entryNature(entry)}</span>}
        <span className={styles.what}>
          {entry.kind === "http" ? <RoutePath routeKey={entry.key} /> : <span className={styles.key}>{entry.handler?.name ?? entry.key}</span>}
          <span className={styles.handler}>{entry.kind === "http" ? entry.handler?.name : entry.kind === "message" ? `file ${entry.key}` : by.join(", ")}</span>
        </span>
        <span className={styles.by}>
          {entry.kind !== "http" ? <span className={styles.pale}>sans clic</span>
            : isUncalled(entry, model) ? <span className={styles.dashed}>aucun appel lu</span>
            : by.length ? by.join(", ") : <span className={styles.pale}>rien de lu</span>}
        </span>
        <span className={styles.reach}>
          {reach.services.map((s) => <span key={s} className={styles.service}>{s}</span>)}
          {reach.topics.map((t) => <span key={t} className={styles.topic}>file {t}</span>)}
          {reach.tables.length > 0 && <span className={styles.tables}>{reach.tables.join(" · ")}</span>}
          {!steps && <span className={styles.pale}>déroulé non lu</span>}
        </span>
        <span className={styles.refusals}>{refusals.length ? count(refusals.length, "refus", "refus") : steps ? "aucun refus" : ""}</span>
        <ProofRef proof={entry.proof} plain />
      </a>
    </li>
  );
}
