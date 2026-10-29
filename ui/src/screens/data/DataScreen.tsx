import { useMemo, useState } from "react";
import type { ScreenProps } from "../../app/ScreenProps";
import { screenHref } from "../../app/screens";
import { ProofRef } from "../../components/ProofRef";
import { Glance } from "../../components/Glance";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusMessage } from "../../components/StatusMessage";
import { storeAccess } from "../../domain/data/actors";
import { storeNotes } from "../../domain/data/notes";
import { dataStores, entityWord, storeEntities } from "../../domain/data/stores";
import { TechLogo } from "../../components/TechLogo";
import { EntityScreen } from "./EntityScreen";
import { count } from "../../domain/text/plural";
import { StorePanel } from "./StorePanel";
import { StoreTabs } from "./StoreTabs";
import { TableGrid } from "./TableGrid";
import { TablePanel } from "./TablePanel";
import styles from "./DataScreen.module.css";

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Les données d'un stockage : qui lit, qui écrit, sous quel contrôle. `#/donnees/<stockage>/<table>`. */
export function DataScreen({ project, map, params }: ScreenProps) {
  const { model, tech } = map;
  const stores = dataStores(model);
  const store = stores.find((s) => s.id === params[0]) ?? stores[0];
  const entities = useMemo(() => (store ? storeEntities(store) : []), [store]);
  const access = useMemo(() => (store ? storeAccess(store, model) : undefined), [store, model]);
  const [selected, setSelected] = useState(params[1]);
  if (!store || !access) return <StatusMessage title="Aucune donnée lue" detail="Aucun stockage de cette carte ne porte de tables ni de collections." />;
  const opened = params[2] && entities.find((e) => e.name === params[1]);
  if (opened) return <EntityScreen project={project} map={map} store={store} entity={opened} access={access} tab={params[2]!} />;

  const [one, many] = entityWord(store);
  const entity = entities.find((e) => e.name === selected);
  const origin = store.proof.find((p) => p.source === "manifest") ?? store.proof[0];
  const techName = (store.tech ?? []).map((t) => tech[t]?.name ?? t).join(", ");
  const logo = store.tech?.[0];

  return (
    <div className={styles.screen}>
      <ScreenHeader
        crumbs={[{ label: project.name }, { label: "Données", href: screenHref("donnees") }, { label: store.name }]}
        title={`${store.name} · ${count(entities.length, one, many)}`}
        lead={<span className={styles.lead}>{logo && <TechLogo id={logo} label={tech[logo]} size={22} />}<span>{techName}{origin && <> · déclaré à <ProofRef proof={origin} /></>} · Qui lit, qui écrit, sous quel contrôle. Chaque case renvoie à sa ligne.</span></span>}
        aside={<Glance notes={storeNotes(store, entities, access, model)} />}
      >
        {stores.length > 1 && <StoreTabs stores={stores} current={store.id} />}
      </ScreenHeader>
      <div className={styles.body}>
        <div className={styles.main}>
          <TableGrid word={capital(many)} storeId={store.id} entities={entities} access={access} model={model} tech={tech} selected={selected}
            onSelect={(name) => setSelected((c) => (c === name ? undefined : name))} />
        </div>
        {entity
          ? <TablePanel entity={entity} entities={entities} store={store} word={capital(one)} access={access} model={model} tech={tech} version={map.builtAt} onClose={() => setSelected(undefined)} />
          : <StorePanel store={store} word={one} access={access} model={model} tech={tech} />}
      </div>
    </div>
  );
}
