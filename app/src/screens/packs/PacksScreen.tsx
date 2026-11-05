import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import type { MapPayload, PacksPayload } from "../../api/types";
import type { Technology } from "../../../../vision/stack/types";
import { techRows } from "../../model/packs";
import { Workshop } from "./Workshop";
import { PacksTable } from "./PacksTable";
import "./packs.css";

/** Planche P2 : une ligne par technologie. Une proposition restée à décider s'ouvre encore dans l'atelier (planche 02). */
export function PacksScreen({ map, item, open, onChanged }: { map: MapPayload; item?: string; open: (id?: string) => void; onChanged: () => void }) {
  const [data, setData] = useState<PacksPayload>();
  const [techs, setTechs] = useState<Technology[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const load = useCallback(() => api.packs().then(setData).catch((e) => setError(String(e.message ?? e))), []);
  useEffect(() => { load(); api.stack().then((s) => setTechs(s.stack.technologies)).catch(() => {}); }, [load, map.builtAt]);
  // Pendant que l'écrivain travaille, l'état se relit ; quand un pack se charge, la carte est rechargée.
  const running = !!data && ((data.job && !data.job.done) || data.queue.length > 0);
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => api.packs().then((d) => { if (data?.job && !data.job.done && d.job?.done) onChanged(); setData(d); }), 2000);
    return () => clearTimeout(t);
  }, [data, running, onChanged]);
  const rows = useMemo(() => data ? techRows(map, data, techs) : [], [map, data, techs]);
  if (error) return <p className="state">{error}</p>;
  if (!data) return <p className="state">Reading packs…</p>;
  const proposal = item ? data.proposals.find((p) => p.id === item) : undefined;
  const act = (f: Promise<PacksPayload>) => f.then((d) => { setData(d); onChanged(); open(); }).catch((e) => setError(String(e.message ?? e)));
  if (proposal) return <Workshop map={map} proposal={proposal} others={data.proposals.filter((p) => p.id !== proposal.id)} open={open} accept={() => act(api.accept(proposal.id))} reject={() => act(api.reject(proposal.id))} />;
  return <PacksTable map={map} data={data} rows={rows} busy={busy}
    write={(pkgs) => { setBusy("write"); api.write(pkgs).then(load).catch((e) => setError(String(e.message ?? e))).finally(() => setBusy(undefined)); }}
    dequeue={(pkg) => api.dequeue(pkg).then(setData).catch((e) => setError(String(e.message ?? e)))}
    retire={(id) => { setBusy(id); api.retire(id).then((d) => { setData(d); onChanged(); }).catch((e) => setError(String(e.message ?? e))).finally(() => setBusy(undefined)); }} />;
}
