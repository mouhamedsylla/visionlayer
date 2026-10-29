import { useMemo, type ReactNode } from "react";
import type { MapPayload, ProjectInfo } from "../api/types";
import { Lexicon } from "../api/Lexicon";
import { SourceVersion } from "../api/SourceVersion";
import { lexiconOf } from "../domain/text/techMarks";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useSidebarFolded } from "./useSidebarFolded";
import styles from "./Shell.module.css";

interface Props {
  current: string;
  project: ProjectInfo;
  map: MapPayload;
  refreshing: boolean;
  onRefresh: () => void;
  children: ReactNode;
}

/** La coquille commune à tous les écrans : barre latérale, barre du haut, puis l'écran. */
export function Shell({ current, project, map, refreshing, onRefresh, children }: Props) {
  const [folded, toggle] = useSidebarFolded();
  const names = useMemo(() => lexiconOf(map.model), [map.model]);
  return (
    <div className={styles.shell}>
      <Sidebar current={current} model={map.model} folded={folded} onToggle={toggle} />
      <div className={styles.main}>
        <Topbar project={project} map={map} refreshing={refreshing} onRefresh={onRefresh} />
        <main className={styles.content}><SourceVersion.Provider value={map.builtAt}><Lexicon.Provider value={names}>{children}</Lexicon.Provider></SourceVersion.Provider></main>
      </div>
    </div>
  );
}
