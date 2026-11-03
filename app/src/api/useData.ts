import { useCallback, useEffect, useState } from "react";
import { api } from "./client";
import type { KnowledgePayload, MapPayload, ProjectInfo } from "./types";

/** Les règles déclarées et celles que le code contredit. */
export interface Claims { total: number; contradicted: number }

export interface Data { project?: ProjectInfo; map?: MapPayload; claims: Claims; knowledge?: KnowledgePayload; error?: string; refreshing: boolean; refresh: () => void }

/** La carte et le projet, lus une fois ; un humain peut demander la mise à jour. */
export function useData(): Data {
  const [project, setProject] = useState<ProjectInfo>();
  const [map, setMap] = useState<MapPayload>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [claims, setClaims] = useState<Claims>({ total: 0, contradicted: 0 });
  const [knowledge, setKnowledge] = useState<KnowledgePayload>();
  useEffect(() => {
    Promise.all([api.project(), api.map()]).then(([p, m]) => { setProject(p); setMap(m); }).catch((e) => setError(String(e.message ?? e)));
    // La connaissance est facultative : sans elle, la carte reste lisible.
    api.knowledge().then((k) => {
      setKnowledge(k);
      const all = k.report.concepts.flatMap((c) => c.claims);
      setClaims({ total: all.length, contradicted: all.filter((c) => c.state === "contradicted").length });
    }).catch(() => {});
  }, []);
  const refresh = useCallback(() => {
    setRefreshing(true);
    api.refresh().then(setMap).catch((e) => setError(String(e.message ?? e))).finally(() => setRefreshing(false));
  }, []);
  return { project, map, claims, knowledge, error, refreshing, refresh };
}
