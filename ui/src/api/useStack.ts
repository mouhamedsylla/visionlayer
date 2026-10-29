import { useEffect, useState } from "react";
import { api } from "./client";
import type { StackPayload } from "./types";

export type StackState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; payload: StackPayload };

/** L'inventaire des technologies, demandé à l'ouverture de l'écran et redemandé quand la carte change (`version`). */
export function useStack(version: string): StackState {
  const [state, setState] = useState<StackState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    api.stack()
      .then((payload) => alive && setState({ status: "ready", payload }))
      .catch((err: Error) => alive && setState({ status: "error", message: err.message }));
    return () => { alive = false; };
  }, [version]);
  return state;
}
