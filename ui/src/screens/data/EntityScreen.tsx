import type { ArchNode, Entity, MapPayload, ProjectInfo } from "../../api/types";
import { screenHref } from "../../app/screens";
import { ScreenHeader } from "../../components/ScreenHeader";
import { ViewTabs, type ViewTab } from "../../components/ViewTabs";
import { writersOf, type StoreAccess } from "../../domain/data/actors";
import { stateFields } from "../../domain/data/lifecycle";
import { joinWords } from "../../domain/text/plural";
import { AccessView } from "./AccessView";
import { CycleView } from "./CycleView";
import { ShapePanel } from "./ShapePanel";
import { ShapeTable } from "./ShapeTable";
import styles from "./DataScreen.module.css";

interface Props {
  project: ProjectInfo;
  map: MapPayload;
  store: ArchNode;
  entity: Entity;
  access: StoreAccess;
  tab: string;
}

/** Une entité ouverte : son cycle de vie, sa forme, ses accès. `#/donnees/<stockage>/<table>/cycle`. */
export function EntityScreen({ project, map, store, entity, access, tab }: Props) {
  const { model, tech } = map;
  const states = stateFields(entity);
  const own = access.byEntity.get(entity.name) ?? new Map();
  const tabs: ViewTab[] = [
    ...(states.length ? [{ id: "cycle", label: "Cycle de vie", icon: "state" as const }] : []),
    { id: "forme", label: "Forme", icon: "data", count: entity.fields?.length ?? 0 },
    { id: "acces", label: "Accès", icon: "read", count: own.size },
  ];
  const current = tabs.find((t) => t.id === tab)?.id ?? tabs[0]!.id;
  const label = (id: string) => access.actors.find((a) => a.id === id)?.label ?? id;
  const writers = writersOf(access, entity.name).map(label);
  const readers = [...own].filter(([, a]) => a.read.length).map(([id]) => label(id));
  const techName = (store.tech ?? []).map((t) => tech[t]?.name ?? t).join(", ");
  const lead = [
    `${entity.group ? `${entity.group} · ` : ""}table ${techName}`,
    writers.length ? `écrite par ${joinWords(writers)}` : "aucune écriture lue",
    readers.length ? `lue par ${joinWords(readers)}` : "",
  ].filter(Boolean).join(" · ");

  return (
    <div className={styles.screen}>
      <ScreenHeader
        crumbs={[{ label: project.name }, { label: "Données", href: screenHref("donnees", store.id) }, { label: entity.name }]}
        title={entity.name}
        lead={lead}
        aside={<ViewTabs label="Vues de l'entité" tabs={tabs} current={current} href={(id) => screenHref("donnees", store.id, entity.name, id)} />}
      />
      <div className={styles.body}>
        <div className={styles.main}>
          {current === "cycle" && states.map((f) => <CycleView key={f.name} entity={entity} field={f} model={model} tech={tech} version={map.builtAt} />)}
          {current === "forme" && <ShapeTable entity={entity} />}
          {current === "acces" && <AccessView entity={entity} access={access} model={model} />}
        </div>
        <ShapePanel entity={entity} storeId={store.id} />
      </div>
    </div>
  );
}
