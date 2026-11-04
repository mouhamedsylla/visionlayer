import { useState } from "react";
import { Logo } from "./icons";
import "./projects.css";

export interface Hub { demo: boolean; projects: { id: string; name: string; note?: string; path?: string }[] }

const open = (id: string) => { window.location.href = `/p/${encodeURIComponent(id)}/#/vue`; };

/** L'entrée du produit : choisir un projet, ou en ouvrir un nouveau par son dossier ou son adresse GitHub. */
export function Projects({ hub }: { hub: Hub }) {
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!target.trim() || busy) return;
    setBusy(true); setError(undefined);
    try {
      const res = await fetch(`/hub/open?target=${encodeURIComponent(target.trim())}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `${res.status}`);
      open(body.id);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); setBusy(false); }
  };
  return (
    <div className="vl pj">
      <header className="pj__head">{Logo}<div><h1>VisionLayer</h1><p>La carte de ce qui tourne, lue dans le code.{hub.demo ? " Démonstration : choisis un projet, explore-le, pose tes questions à Muse." : ""}</p></div></header>
      {!hub.demo && (
        <form className="pj__open" onSubmit={submit}>
          <label htmlFor="pj-target">Ouvrir un projet</label>
          <div><input id="pj-target" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="/chemin/du/projet ou https://github.com/propriétaire/dépôt" disabled={busy} autoFocus /><button className="vl-btn vl-btn--primary" disabled={busy || !target.trim()}>{busy ? "Lecture…" : "Ouvrir"}</button></div>
          <small>Le code est seulement lu : rien n'est installé ni exécuté.</small>
          {error && <p className="pj__err">{error}</p>}
        </form>
      )}
      {hub.projects.length > 0 && <section className="pj__list">
        <h2>{hub.demo ? "Projets" : "Projets récents"}</h2>
        {hub.projects.map((p) => <button key={p.id} className="pj__row" onClick={() => open(p.id)}><b>{p.name}</b><span>{p.note ?? p.path ?? ""}</span><i>›</i></button>)}
      </section>}
    </div>
  );
}
