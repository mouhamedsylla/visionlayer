import { useEffect, useState } from "react";
import { api } from "./client";
import type { KnowledgePayload } from "./types";

export type KnowledgeState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; payload: KnowledgePayload };

/** La connaissance déclarée, demandée à l'ouverture de l'écran et redemandée quand la carte change (`version`). */
export function useKnowledge(version: string): KnowledgeState {
  const [state, setState] = useState<KnowledgeState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    api.knowledge()
      .then((payload) => alive && setState({ status: "ready", payload }))
      .catch((err: Error) => alive && setState({ status: "error", message: err.message }));
    return () => { alive = false; };
  }, [version]);
  return state;
}
