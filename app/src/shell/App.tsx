import { useData } from "../api/useData";
import { CodeProvider } from "../ui/code";
import { Overview } from "../screens/overview/Overview";
import { MapScreen } from "../screens/map/MapScreen";
import { PacksScreen } from "../screens/packs/PacksScreen";
import { AccessScreen } from "../screens/access/AccessScreen";
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
          {data.error ? <p className="state">La carte n'a pas pu être lue : {data.error}</p>
            : !data.map ? <p className="state">Lecture du dépôt…</p>
            : screen === "carte" ? <MapScreen map={data.map} selected={item} select={(id) => go("carte", id)} />
            : screen === "acces" ? <AccessScreen map={data.map} />
            : screen === "packs" ? <PacksScreen map={data.map} item={item} open={(id) => go("packs", id)} onChanged={data.refresh} />
            : <Overview map={data.map} project={data.project} claims={data.claims} go={go} />}
        </main>
      </div>
    </CodeProvider>
  );
}
