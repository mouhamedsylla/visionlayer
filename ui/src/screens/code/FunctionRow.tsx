import type { ArchNode, CodeFunction, Entrypoint } from "../../api/types";
import { screenHref } from "../../app/screens";
import { Breakable } from "../../components/Breakable";
import { ProofRef } from "../../components/ProofRef";
import { RouteMethod } from "../../components/RouteKey";
import { TechMark } from "../../components/TechText";
import { entryNature } from "../../domain/block/entries";
import { entryOf, fnCounts } from "../../domain/code/functions";
import { reachOf } from "../../domain/features/list";
import { count } from "../../domain/text/plural";
import styles from "./FunctionRow.module.css";

/** Le point d'entrée qu'une fonction porte, en pastille : la méthode d'une route, ou sa nature. */
function EntryBadge({ entry }: { entry: Entrypoint }) {
  return entry.kind === "http" ? <RouteMethod routeKey={entry.key} /> : <span className={styles.nature}>{entryNature(entry)}</span>;
}

/** Une fonction en une ligne : la route qu'elle porte, son nom, ce qu'elle touche, ses étapes, ses refus, qui l'appelle. Un clic ouvre sa fiche. */
export function FunctionRow({ fn, node, names }: { fn: CodeFunction; node: ArchNode; names: Map<string, string> }) {
  const c = fnCounts(fn);
  const entry = entryOf({ fn, node });
  const reach = reachOf(fn, names);
  return (
    <li>
      <a className={styles.row} href={screenHref("code", fn.id)}>
        <span className={styles.name}>{entry && <EntryBadge entry={entry} />}<Breakable text={`${fn.name}()`} />{fn.exported && <small>exportée</small>}</span>
        <span className={styles.reach}>
          {reach.tables.map((t) => <TechMark key={t} piece={{ text: t, kind: "table" }} />)}
          {reach.topics.map((t) => <TechMark key={t} piece={{ text: t, kind: "queue" }} />)}
          {reach.services.map((t) => <TechMark key={t} piece={{ text: t, kind: "block" }} />)}
        </span>
        <span className={styles.num}>{c.steps ? count(c.steps, "étape") : "aucune étape"}</span>
        <span className={styles.num}>{c.refusals ? count(c.refusals, "refus", "refus") : ""}</span>
        <span className={styles.num}>{c.callers ? `appelée ${c.callers} fois` : ""}</span>
        <ProofRef proof={fn.proof} plain />
      </a>
    </li>
  );
}
