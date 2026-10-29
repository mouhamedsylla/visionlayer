import { useState } from "react";
import { screenHref } from "../../app/screens";
import { Chip } from "../../components/Chip";
import { ProofRef } from "../../components/ProofRef";
import { RouteMethod, RoutePath } from "../../components/RouteKey";
import { TechText } from "../../components/TechText";
import { LEVEL_LABEL } from "../../domain/identity/facts";
import type { GuardedEntry, LevelRow } from "../../domain/identity/guards";
import styles from "./AccessRow.module.css";

const SHOWN = 5;

const HOW: Record<LevelRow["level"], string> = {
  public: "aucune fonction du dépôt ne refuse devant elles",
  signature: "le code vérifie la signature du service qui appelle",
  authenticated: "une fonction refuse en 401 sans preuve d'identité",
  role: "une fonction refuse en 403 sans le rôle",
  internal: "appelées seulement de l'intérieur du système",
  unknown: "une garde est là, sans que le pack sache dire laquelle",
};

function Route({ item, on }: { item: GuardedEntry; on: boolean }) {
  const { entry } = item;
  return (
    <a className={`${styles.route} ${on ? styles.on : ""}`} href={screenHref("acces", entry.id)} aria-current={on ? "true" : undefined}>
      {entry.kind === "http" ? <><RouteMethod routeKey={entry.key} /><RoutePath routeKey={entry.key} inline /></> : <code>{entry.key}</code>}
      {item.writes.length > 0 && <span className={styles.writes}>écrit {item.writes.map((w) => <Chip key={w}>{w}</Chip>)}</span>}
      {item.checks.map((c) => <Chip key={c.status} tone="strong" title={c.when}>vérifie l'appelant · {c.status}</Chip>)}
    </a>
  );
}

/** Une ligne de « Qui peut faire quoi » : le niveau, les fonctions qui le tiennent avec leurs refus, puis ses routes. */
export function AccessRow({ row, selected }: { row: LevelRow; selected?: string }) {
  const [all, setAll] = useState(false);
  const label = LEVEL_LABEL[row.level];
  const shown = all ? row.entries : row.entries.slice(0, SHOWN);
  return (
    <section className={`${styles.row} ${styles[row.level] ?? ""}`} aria-label={label.title}>
      <header className={styles.head}>
        <span className={styles.level}>{label.title}</span>
        <span className={styles.count}>{row.entries.length}</span>
        <span className={styles.how}>{HOW[row.level]}</span>
      </header>
      {row.guards.map((g) => (
        <div key={`${g.ref.path}:${g.ref.line}`} className={styles.guard}>
          <code className={styles.fn}>{g.ref.name}()</code>
          {g.refusals.map((r) => <Chip key={r.status} tone="strong">{r.status}{r.code ? ` · ${r.code}` : ""}</Chip>)}
          {g.reads.length > 0 && <span className={styles.reads}><TechText text={`lit ${g.reads.map((r) => r.entity).join(", ")}`} /></span>}
          <ProofRef proof={g.ref} />
        </div>
      ))}
      <div className={styles.routes}>
        {shown.map((e) => <Route key={e.entry.id} item={e} on={e.entry.id === selected} />)}
      </div>
      {row.entries.length > SHOWN && (
        <button type="button" className={styles.more} onClick={() => setAll(!all)}>
          {all ? "Réduire" : `Voir les ${row.entries.length - SHOWN} autres`}
        </button>
      )}
    </section>
  );
}
