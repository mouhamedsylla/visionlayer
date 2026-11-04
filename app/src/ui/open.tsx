import { createContext, useContext, type ReactNode } from "react";
import type { MapPayload } from "../api/types";
import { placeOf, type Target } from "../model/destinations";
import type { Screen } from "../shell/route";

type Go = (screen: Screen, item?: string) => void;
const Ctx = createContext<{ map?: MapPayload; go?: Go }>({});

export function OpenProvider({ map, go, children }: { map?: MapPayload; go: Go; children: ReactNode }) {
  return <Ctx.Provider value={{ ...(map ? { map } : {}), go }}>{children}</Ctx.Provider>;
}

/**
 * Un objet dessiné qui s'ouvre (planche L6) : une table, une file, un service, là où il est, sans que l'écran sache
 * où cela mène. Il vit souvent dans une ligne déjà cliquable : le clic ne remonte pas. Sans destination, il reste un
 * texte.
 */
export function Obj({ to, children, className = "" }: { to?: Target; children: ReactNode; className?: string }) {
  const { map, go } = useContext(Ctx);
  const place = to && map ? placeOf(map, to) : undefined;
  if (!place || !go) return <>{children}</>;
  const open = (e: { stopPropagation: () => void; preventDefault: () => void }) => { e.stopPropagation(); e.preventDefault(); go(place.screen, place.item); };
  return (
    <span role="link" tabIndex={0} title={place.label} className={`obj ${className}`} onClick={open} onKeyDown={(e) => { if (e.key === "Enter") open(e); }}>{children}</span>
  );
}
