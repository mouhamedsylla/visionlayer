import { useWorkspace } from "../api/useWorkspace";
import { Shell } from "../shell/Shell";
import { StatusMessage } from "../components/StatusMessage";
import { DEFAULT_SCREEN, findScreen, parseRoute } from "./screens";
import { useHashRoute } from "./useHashRoute";

export function App() {
  const { workspace, refresh } = useWorkspace();
  const route = useHashRoute(DEFAULT_SCREEN);
  const { id, params } = parseRoute(route);
  const screen = findScreen(id) ?? findScreen(DEFAULT_SCREEN)!;

  if (workspace.status === "loading") return <StatusMessage title="Lecture du dépôt" />;
  if (workspace.status === "error") return <StatusMessage title="La carte n'a pas pu être lue" detail={workspace.message} />;

  const Screen = screen.component!;
  return (
    <Shell current={screen.id} project={workspace.project} map={workspace.map} refreshing={workspace.refreshing} onRefresh={refresh}>
      <Screen key={route} project={workspace.project} map={workspace.map} params={screen.id === id ? params : []} />
    </Shell>
  );
}
