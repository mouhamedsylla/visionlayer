import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import type { MapPayload, PacksPayload } from "../../api/types";
import { Workshop } from "./Workshop";
import { PacksHome } from "./PacksHome";
import "./packs.css";

/** Planche 02, l'Atelier de pack : une proposition de l'écrivain à décider, sinon ce qui n'est pas lu et l'écrivain à lancer. */
export function PacksScreen({ map, item, open, onChanged }: { map: MapPayload; item?: string; open: (id?: string) => void; onChanged: () => void }) {
  const [data, setData] = useState<PacksPayload>();
  const [error, setError] = useState<string>();
  const load = useCallback(() => api.packs().then(setData).catch((e) => setError(String(e.message ?? e))), []);
  useEffect(() => { load(); }, [load]);
  // Pendant que l'écrivain travaille, ses lignes arrivent ; à la fin, sa proposition s'ouvre.
  useEffect(() => {
    if (!data?.job || data.job.done) return;
    const t = setTimeout(load, 2000);
    return () => clearTimeout(t);
  }, [data, load]);
  if (error) return <p className="state">{error}</p>;
  if (!data) return <p className="state">Lecture des packs…</p>;
  const proposal = data.proposals.find((p) => p.id === item) ?? (item ? undefined : data.proposals[0]);
  const act = (f: Promise<PacksPayload>, next?: string) => f.then((d) => { setData(d); onChanged(); open(next); }).catch((e) => setError(String(e.message ?? e)));
  return proposal
    ? <Workshop map={map} proposal={proposal} others={data.proposals.filter((p) => p.id !== proposal.id)} open={open}
        accept={() => act(api.accept(proposal.id))} reject={() => act(api.reject(proposal.id))} />
    : <PacksHome map={map} data={data} open={open} write={(pkg) => api.write(pkg).then(load).catch((e) => setError(String(e.message ?? e)))} />;
}
