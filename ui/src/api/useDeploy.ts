import { useEffect, useState } from "react";
import { api } from "./client";
import type { DeployPayload } from "./types";

export type DeployState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; payload: DeployPayload };

/** Les chaînes de livraison, demandées à l'ouverture de l'écran et redemandées quand la carte change (`version`). */
export function useDeploy(version: string): DeployState {
  const [state, setState] = useState<DeployState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    api.deploy()
      .then((payload) => alive && setState({ status: "ready", payload }))
      .catch((err: Error) => alive && setState({ status: "error", message: err.message }));
    return () => { alive = false; };
  }, [version]);
  return state;
}
