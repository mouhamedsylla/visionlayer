import { useState } from "react";
import type { Entrypoint, MapPayload } from "../../api/types";
import { RouteMethod, RoutePath } from "../../components/RouteKey";
import type { EntryRef } from "../../domain/features/list";
import { CALLER, stepView, traceLanes } from "../../domain/features/trace";
import type { GuardFn } from "../../domain/identity/guards";
import { count } from "../../domain/text/plural";
import { SequenceView } from "../features/SequenceView";
import { TraceLegend } from "../features/TraceLegend";
import styles from "./IdentityScreen.module.css";

interface Props {
  open: EntryRef[];
  guards: GuardFn[];
  map: MapPayload;
  names: Map<string, string>;
}

/** Une garde déroulée comme un point d'entrée : son code, ce qu'elle lit, ses refus ; appelée par chaque route qu'elle garde. */
function guardTrace(g: GuardFn, map: MapPayload, names: Map<string, string>) {
  const fn = g.fn!;
  const entry: Entrypoint = { id: fn.id, kind: "rpc", key: fn.name, handler: { path: fn.proof.path, line: fn.proof.line, name: fn.name }, proof: fn.proof, flow: fn.flow, calledBy: [] };
  const item: EntryRef = { entry, node: g.node };
  const lanes = traceLanes(item, map.model, names).map((l) => (l.id === CALLER ? { ...l, title: "Chaque route gardée", sub: count(g.entries.length, "route") } : l));
  return { item, trace: { lanes, rows: (fn.flow ?? []).map((s) => ({ step: s, view: stepView(s, g.node.id, names) })) } };
}

/** « Comment on entre » : là où l'on obtient sa preuve d'identité, puis comment chaque appel est reconnu. */
export function EntryFlows({ open, guards, map, names }: Props) {
  const [at, setAt] = useState(0);
  const opener = open[at];
  const followed = guards.filter((g) => g.fn?.flow?.length);
  return (
    <>
      <section className={styles.section} aria-label="Où l'on obtient sa preuve d'identité">
        <h2 className={styles.title}>Où l'on obtient sa preuve d'identité</h2>
        {opener ? (
          <>
            {open.length > 1 && (
              <nav className={styles.choices} aria-label="Entrées qui ouvrent une preuve">
                {open.map((o, i) => (
                  <button key={o.entry.id} type="button" className={i === at ? styles.chosen : undefined} aria-pressed={i === at} onClick={() => setAt(i)}>
                    <RouteMethod routeKey={o.entry.key} /><RoutePath routeKey={o.entry.key} inline />
                  </button>
                ))}
              </nav>
            )}
            <SequenceView key={opener.entry.id} item={opener} map={map} names={names} />
          </>
        ) : <p className={styles.none}>Aucune entrée ouverte à tous n'écrit ce que la garde lit : la preuve d'identité vient d'ailleurs (un service externe, un autre dépôt), ou n'est pas lue.</p>}
      </section>
      {followed.map((g) => {
        const { item, trace } = guardTrace(g, map, names);
        return (
          <section key={g.fn!.id} className={styles.section} aria-label={`Comment ${g.ref.name} reconnaît l'appelant`}>
            <h2 className={styles.title}>Puis, à chaque appel : <code className={styles.code}>{g.ref.name}()</code></h2>
            <SequenceView item={item} map={map} names={names} trace={trace} />
          </section>
        );
      })}
      <TraceLegend />
    </>
  );
}
