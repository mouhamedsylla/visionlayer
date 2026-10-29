import { useCallback, useEffect, useState } from "react";
import { api } from "./client";
import type { MapPayload, ProjectInfo } from "./types";

export type Workspace =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; project: ProjectInfo; map: MapPayload; refreshing: boolean };

/** Le projet ouvert et sa carte, chargés une fois ; `refresh` relance l'analyse sur un clic. */
export function useWorkspace(): { workspace: Workspace; refresh: () => void } {
  const [workspace, setWorkspace] = useState<Workspace>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    Promise.all([api.project(), api.map()])
      .then(([project, map]) => alive && setWorkspace({ status: "ready", project, map, refreshing: false }))
      .catch((err: Error) => alive && setWorkspace({ status: "error", message: err.message }));
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(() => {
    setWorkspace((w) => (w.status === "ready" ? { ...w, refreshing: true } : w));
    api
      .refreshMap()
      .then((map) => setWorkspace((w) => (w.status === "ready" ? { ...w, map, refreshing: false } : w)))
      .catch((err: Error) => setWorkspace({ status: "error", message: err.message }));
  }, []);

  return { workspace, refresh };
}
