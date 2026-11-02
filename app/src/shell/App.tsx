import { useData } from "../api/useData";
import { CodeProvider } from "../ui/code";
import { Overview } from "../screens/overview/Overview";
import { MapScreen } from "../screens/map/MapScreen";
import { PacksScreen } from "../screens/packs/PacksScreen";
import { AccessScreen } from "../screens/access/AccessScreen";
import { DataScreen } from "../screens/data/DataScreen";
import { TasksScreen } from "../screens/tasks/TasksScreen";
import { BlockScreen } from "../screens/block/BlockScreen";
import { FlowScreen } from "../screens/flow/FlowScreen";
import { AgentsScreen } from "../screens/agents/AgentsScreen";
import { SettingsScreen } from "../screens/settings/SettingsScreen";
import { findEntry } from "../model/flow";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { SCREENS, useRoute } from "./route";

export function App() {
  const data = useData();
  const { screen, item, go } = useRoute();
  const title = SCREENS.find((s) => s.id === screen)!.label;
  return (
    <CodeProvider>
      <div className="vl app">
        <Sidebar project={data.project} map={data.map} screen={screen} go={go} />
        <main className="main">
          <Topbar project={data.project} map={data.map} title={title} refreshing={data.refreshing} onRefresh={data.refresh} />
          {data.error ? <p className="view state">La carte n'a pas pu être lue : {data.error}</p>
            : !data.map ? <p className="view state">Lecture du dépôt…</p>
            : screen === "carte" ? <div key={screen} className="view view--ws scr-map"><MapScreen map={data.map} selected={item} select={(id) => go("carte", id)} enter={(id) => go("bloc", id)} openFlow={(id) => go("deroule", id)} /></div>
            : screen === "bloc" && data.map.model.nodes.find((n) => n.id === item) ? <div key={`${screen}/${item ?? ""}`} className="view view--ws scr-bk"><BlockScreen map={data.map} block={data.map.model.nodes.find((n) => n.id === item)!} openFlow={(id) => go("deroule", id)} back={() => go("carte", item)} /></div>
            : screen === "deroule" && item ? <div key={`${screen}/${item ?? ""}`} className="view view--ws scr-fl"><FlowScreen map={data.map} entryId={item} found={findEntry(data.map, item)} back={() => go("carte", findEntry(data.map!, item)?.owner.id)} toBlock={() => go("bloc", findEntry(data.map!, item)?.owner.id)} /></div>
            : screen === "acces" ? <div key={screen} className="view view--ws scr-ax"><AccessScreen map={data.map} openFlow={(id) => go("deroule", id)} /></div>
            : screen === "taches" ? <div key={screen} className="view view--ws scr-tk"><TasksScreen map={data.map} openFlow={(id) => go("deroule", id)} /></div>
            : screen === "donnees" ? <div key={screen} className="view view--ws scr-dx"><DataScreen map={data.map} item={item} open={(id) => go("donnees", id)} openFlow={(id) => go("deroule", id)} /></div>
            : screen === "agents" ? <div key={screen} className="view view--ws scr-ag"><AgentsScreen map={data.map} enter={(id) => go("bloc", id)} /></div>
            : screen === "reglages" ? <div key={screen} className="view scr-st"><SettingsScreen /></div>
            : screen === "packs" ? <div key={screen} className="view scr-pk"><PacksScreen map={data.map} item={item} open={(id) => go("packs", id)} onChanged={data.refresh} /></div>
            : <div key={screen} className="view scr-ov"><Overview map={data.map} project={data.project} claims={data.claims} go={go} /></div>}
        </main>
      </div>
    </CodeProvider>
  );
}
