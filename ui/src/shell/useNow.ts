import { useEffect, useState } from "react";

/** L'heure courante, relue à intervalle régulier : pour un « il y a 3 min » qui avance tout seul. */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
