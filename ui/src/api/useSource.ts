import { useEffect, useState } from "react";
import { api } from "./client";
import type { SourceExcerpt } from "./types";

export type SourceState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; excerpt: SourceExcerpt };

/** Un passage de fichier, relu quand la carte change (`version`) ; rien n'est demandé sans passage. */
export function useSource(span: { path: string; from: number; to: number } | undefined, version: string): SourceState | undefined {
  const [state, setState] = useState<SourceState>();
  const [path, from, to] = [span?.path, span?.from ?? 0, span?.to ?? 0];
  useEffect(() => {
    if (!path) { setState(undefined); return; }
    let alive = true;
    setState({ status: "loading" });
    api.source(path, from, to)
      .then((excerpt) => alive && setState({ status: "ready", excerpt }))
      .catch((err: Error) => alive && setState({ status: "error", message: err.message }));
    return () => { alive = false; };
  }, [path, from, to, version]);
  return state;
}
