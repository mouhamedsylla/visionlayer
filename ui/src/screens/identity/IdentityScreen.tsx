import { useMemo } from "react";
import type { ScreenProps } from "../../app/ScreenProps";
import { Glance } from "../../components/Glance";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusMessage } from "../../components/StatusMessage";
import { credentialStores, openers } from "../../domain/identity/credentials";
import { identityFacts, identityNotes } from "../../domain/identity/facts";
import { accessRows } from "../../domain/identity/guards";
import { FactsRow } from "../architecture/FactsRow";
import { AccessRow } from "./AccessRow";
import { CredentialList } from "./CredentialList";
import { EntryFlows } from "./EntryFlows";
import { IdentityPanel } from "./IdentityPanel";
import styles from "./IdentityScreen.module.css";

/** `#/acces` : comment un appelant prouve qui il est, puis ce qu'il peut atteindre (maquette 26) ; `#/acces/<point d'entrée>` ouvre une route. */
export function IdentityScreen({ project, map, params }: ScreenProps) {
  const { model } = map;
  const names = useMemo(() => new Map(model.nodes.map((n) => [n.id, n.name])), [model]);
  const read = useMemo(() => {
    const { rows, guards, unread } = accessRows(model);
    const stores = credentialStores(model, guards);
    return { rows, guards, unread, stores, open: openers(stores) };
  }, [model]);
  const { rows, guards, unread, stores, open } = read;
  if (!rows.length) {
    return <StatusMessage title="Aucune garde lue" detail="Aucun pack n'a lu la garde d'un point d'entrée de ce projet : on ne sait pas qui peut appeler quoi. Ce n'est pas la même chose qu'un système ouvert." />;
  }
  const item = rows.flatMap((r) => r.entries).find((e) => e.entry.id === params[0]);
  const guard = [...guards].sort((a, b) => b.entries.length - a.entries.length)[0];
  return (
    <div className={styles.screen}>
      <ScreenHeader crumbs={[{ label: project.name }, { label: "Accès" }]} title="Comment un appelant est reconnu, puis autorisé"
        lead="Lu dans le code des routes : la fonction qui refuse devant chacune, ce qu'elle lit pour reconnaître l'appelant, et où l'on obtient cette preuve. Les comptes réels ne sont pas lus."
        aside={<Glance notes={identityNotes(read, model, unread)} />}>
        <FactsRow facts={identityFacts(read, model)} tech={map.tech} />
      </ScreenHeader>
      <div className={styles.body}>
        <div className={styles.main}>
          <EntryFlows open={open} guards={guards} map={map} names={names} />
          <section className={styles.section} aria-label="Qui peut faire quoi">
            <h2 className={styles.title}>Qui peut faire quoi <span className={styles.hint}>vérifié côté serveur, route par route</span></h2>
            {rows.map((r) => <AccessRow key={r.level} row={r} selected={item?.entry.id} />)}
          </section>
          <section className={styles.section} aria-label="La preuve d'identité">
            <h2 className={styles.title}>Ce que la garde lit, et qui l'écrit <span className={styles.hint}>création, usage et fin de la preuve</span></h2>
            <CredentialList stores={stores} names={names} />
          </section>
        </div>
        <IdentityPanel item={item} guard={guard} map={map} names={names} />
      </div>
    </div>
  );
}
