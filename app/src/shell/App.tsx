import { OpenProvider } from "../ui/open";
import { useData } from "../api/useData";
import { CodeProvider } from "../ui/code";
import { VigieProvider } from "../vigie/Vigie";
import { Overview } from "../screens/overview/Overview";
import { MapScreen } from "../screens/map/MapScreen";
import { PacksScreen } from "../screens/packs/PacksScreen";
import { AccessScreen } from "../screens/access/AccessScreen";
import { RulesScreen } from "../screens/rules/RulesScreen";
import { DataScreen } from "../screens/data/DataScreen";
import { TasksScreen } from "../screens/tasks/TasksScreen";
import { BlockScreen } from "../screens/block/BlockScreen";
import { FlowScreen } from "../screens/flow/FlowScreen";
import { AgentsScreen } from "../screens/agents/AgentsScreen";
import { SettingsScreen } from "../screens/settings/SettingsScreen";
import { FeaturesScreen } from "../screens/features/FeaturesScreen";
import { ReplaysScreen } from "../screens/replay/ReplaysScreen";
import { MechanismsScreen } from "../screens/mechanisms/MechanismsScreen";
import { TableScreen } from "../screens/data/TableScreen";
import { findTable } from "../model/table";
import { findEntry } from "../model/flow";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { placeLabel, useRoute } from "./route";

const SCOPED = new Set<string>(["acces", "donnees", "mecanismes", "taches", "regles"]);
/** Ces écrans ont leur propre bouton de retour, dans leur en-tête. */
const DEEP_BACK = new Set<string>(["bloc", "deroule", "table"]);

export function App() {
  const data = useData();
  const { screen, item, scope, tab, go, from, back, origin, crumbs } = useRoute();
  // Le bloc que suit l'écran, là où ce filtre a un sens (planche 03b).
  const block = screen && SCOPED.has(screen) ? data.map?.model.nodes.find((n) => n.id === scope) : undefined;
  const backTo = (fallback: () => void) => ({ back: back ?? fallback, backLabel: from ? placeLabel(from) : undefined });
  return (
    <CodeProvider>
      <VigieProvider map={data.map}><OpenProvider map={data.map} go={go}>
      <div className="vl app">
        <Sidebar project={data.project} map={data.map} screen={origin} go={(s) => go(s, undefined, { root: true, scope: null })} />
        <main className="main">
          <Topbar project={data.project} map={data.map} crumbs={crumbs} {...(!DEEP_BACK.has(screen) && back && from ? { back, backLabel: from.screen === "carte" && from.item ? from.item : placeLabel(from) } : !DEEP_BACK.has(screen) && screen !== "carte" && item ? { back: () => go(screen, undefined, { root: true }), backLabel: placeLabel({ screen }) } : {})} {...(block ? { block, clearBlock: () => go(screen, item, { scope: null, replace: true }) } : {})} refreshing={data.refreshing} onRefresh={data.refresh} />
          {data.error ? <p className="view state">La carte n'a pas pu être lue : {data.error}</p>
            : !data.map ? <p className="view state">Lecture du dépôt…</p>
            : screen === "carte" ? <div key={screen} className="view view--ws scr-map"><MapScreen map={data.map} {...(data.knowledge ? { knowledge: data.knowledge } : {})} selected={item} select={(id) => go("carte", id, { replace: true })} ask={(id, q) => go(q.screen, q.item, { leaving: { screen: "carte", item: id }, ...(q.scope ? { scope: q.scope } : {}) })} enter={(id) => {
              const n = data.map!.model.nodes.find((x) => x.id === id);
              const topic = n?.facets.channel?.topics[0]?.name;
              if (n?.role === "channel" && topic) go("mecanismes", `files:${id}/${topic}`);
              else if (n?.role === "store" || n?.role === "channel") go("donnees", id);
              else go("bloc", id);
            }} /></div>
            : screen === "fonctionnalites" ? <div key={screen} className="view scr-ft"><FeaturesScreen map={data.map} openFlow={(id) => go("deroule", id)} /></div>
            : screen === "bloc" && data.map.model.nodes.find((n) => n.id === item) ? <div key={`${screen}/${item ?? ""}`} className="view view--ws scr-bk"><BlockScreen map={data.map} block={data.map.model.nodes.find((n) => n.id === item)!} openFlow={(id) => go("deroule", id)} {...backTo(() => go("carte", item))} /></div>
            : screen === "deroule" && item ? <div key={`${screen}/${item ?? ""}`} className="view view--ws scr-fl"><FlowScreen map={data.map} {...(tab ? { tab } : {})} openTab={(x) => go("deroule", item, { replace: true, tab: x })} entryId={item} found={findEntry(data.map, item)} {...backTo(() => go("carte", findEntry(data.map!, item)?.owner.id))} toBlock={() => go("bloc", findEntry(data.map!, item)?.owner.id)} /></div>
            : screen === "table" && item && findTable(data.map, item) ? (() => { const t = findTable(data.map!, item)!; return <div key={`${screen}/${item}`} className="view view--ws scr-dx scr-fl scr-tb"><TableScreen map={data.map!} store={t.store} entity={t.entity} knowledge={data.knowledge} {...(tab ? { tab } : {})} openTab={(x) => go("table", item, { replace: true, tab: x })} openFlow={(id) => go("deroule", id)} {...backTo(() => go("donnees", `${t.store.id}/${t.entity.name}`))} /></div>; })()
            : screen === "mecanismes" ? <div key={screen} className="view view--ws scr-mc"><MechanismsScreen map={data.map} {...(block ? { block } : {})} item={item} open={(id) => go("mecanismes", id, { replace: true })} /></div>
            : screen === "acces" ? <div key={screen} className="view view--ws scr-ax"><AccessScreen map={data.map} {...(block ? { block } : {})} item={item} open={(id) => go("acces", id, { replace: true })} openFlow={(id) => go("deroule", id)} /></div>
            : screen === "taches" ? <div key={screen} className="view view--ws scr-tk"><TasksScreen map={data.map} {...(block ? { block } : {})} openFlow={(id) => go("deroule", id)} /></div>
            : screen === "donnees" ? <div key={screen} className="view view--ws scr-dx"><DataScreen map={data.map} {...(block ? { block } : {})} item={item} open={(id, replace) => go("donnees", id, { replace })} openFlow={(id) => go("deroule", id)} openTable={(id) => go("table", id)} /></div>
            : screen === "regles" ? <div key={screen} className="view scr-rg"><RulesScreen map={data.map} {...(block ? { block } : {})} knowledge={data.knowledge} item={item} open={(id) => go("regles", id, { replace: true })} /></div>
            : screen === "agents" ? <div key={screen} className="view view--ws scr-ag"><AgentsScreen map={data.map} enter={(id) => go("bloc", id)} /></div>
            : screen === "replays" ? <div key={`${screen}/${item ?? ""}`} className="view scr-rp"><ReplaysScreen item={item} open={(id) => go("replays", id)} /></div>
            : screen === "reglages" ? <div key={screen} className="view scr-st"><SettingsScreen /></div>
            : screen === "packs" ? <div key={screen} className="view scr-pk"><PacksScreen map={data.map} item={item} open={(id) => go("packs", id)} onChanged={data.refresh} /></div>
            : <div key={screen} className="view scr-ov"><Overview map={data.map} project={data.project} claims={data.claims} go={go} /></div>}
        </main>
      </div>
      </OpenProvider></VigieProvider>
    </CodeProvider>
  );
}
