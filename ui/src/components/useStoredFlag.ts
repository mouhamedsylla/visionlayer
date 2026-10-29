import { useCallback, useEffect, useState } from "react";

function read(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** Un oui/non d'affichage (barre réduite, panneau replié) : une préférence de cet écran, gardée dans ce navigateur. */
export function useStoredFlag(key: string): [boolean, () => void] {
  const [on, setOn] = useState(() => read(key));
  // écrit après coup, jamais dans la mise à jour elle-même : React peut la rejouer
  useEffect(() => {
    try {
      window.localStorage.setItem(key, on ? "1" : "0");
    } catch {
      // Stockage refusé : la préférence vaut pour cette session seulement.
    }
  }, [key, on]);
  const toggle = useCallback(() => setOn((f) => !f), []);
  return [on, toggle];
}
