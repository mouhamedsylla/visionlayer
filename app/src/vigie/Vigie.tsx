import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { MapPayload, VigieAnswer } from "../api/types";
import { CodeRef } from "../ui/CodeRef";
import { useOpenCode } from "../ui/code";
import { Face, PERSONAS, useFace } from "./Face";
import "./vigie.css";

/** Ouvrir Vigie depuis n'importe quel écran, avec une question déjà posée ou non. */
const Ctx = createContext<(q?: string) => void>(() => {});
export const useVigie = () => useContext(Ctx);

interface Turn { q: string; a?: VigieAnswer; error?: string }

export function VigieProvider({ map, children }: { map?: MapPayload; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const ask = (q: string) => {
    if (!q.trim() || busy) return;
    setBusy(true); setDraft("");
    setTurns((t) => [...t, { q }]);
    api.vigie(q).then((a) => setTurns((t) => t.map((x, i) => i === t.length - 1 ? { ...x, a } : x)))
      .catch((e) => setTurns((t) => t.map((x, i) => i === t.length - 1 ? { ...x, error: String(e.message ?? e) } : x)))
      .finally(() => setBusy(false));
  };
  const show = (q?: string) => { setOpen(true); if (q) ask(q); };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {open && <Panel map={map} turns={turns} busy={busy} draft={draft} setDraft={setDraft} ask={ask} close={() => setOpen(false)} />}
    </Ctx.Provider>
  );
}

/** Trois questions d'exemple, tirées de la carte : la route la plus exposée, le déroulé le plus long, et une hors couverture. */
function examples(map?: MapPayload): string[] {
  if (!map) return [];
  const entries = map.model.nodes.flatMap((n) => n.facets.entrypoints ?? []).filter((e) => e.kind === "http");
  const flagged = map.model.findings.find((f) => f.code === "unguarded_route");
  const key = flagged?.message.match(/`((?:GET|POST|PUT|PATCH|DELETE) [^`]+)`/)?.[1];
  const longest = [...entries].sort((a, b) => (b.flow?.length ?? 0) - (a.flow?.length ?? 0))[0];
  return [
    key ? `Qui peut appeler ${key}, et qu'est-ce qui le vérifie ?` : "Quelles routes sont ouvertes sans connexion ?",
    longest ? `Que fait ${longest.key}, dans quel ordre ?` : "Quelles tables sont écrites par plusieurs fonctions ?",
    "Quelle est la latence de l'API en production ?",
  ];
}

function Panel({ map, turns, busy, draft, setDraft, ask, close }: { map?: MapPayload; turns: Turn[]; busy: boolean; draft: string; setDraft: (s: string) => void; ask: (q: string) => void; close: () => void }) {
  const end = useRef<HTMLDivElement>(null);
  const face = useFace();
  const name = PERSONAS.find((p) => p.id === face)?.name;
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [turns.length, busy]);
  return (
    <aside className="vg" aria-label="Vigie">
      <header className="vg__head">
        <Face mood={busy ? "think" : "welcome"} size={46} ring={busy} />
        <span className="vg__who"><b>Vigie{name ? `, ${name}` : ""}</b><small>{busy ? <>lit la carte<i className="vg__dots"><i /><i /><i /></i></> : "répond depuis la carte, cite ses lignes"}</small></span>
        <button className="vg__close" onClick={close} aria-label="Fermer">×</button>
      </header>
      <div className="vg__body">
        {turns.length === 0 && (
          <div className="vg__intro">
            <div className="vg__msg"><Face mood="welcome" size={30} /><p className="vg__bub">Pose-moi une question sur le système. Je ne lis que ce que VisionLayer a lu : la carte, et le code qu'elle cite. Ce que je ne couvre pas, je te le dis « non lu ».</p></div>
            <div className="vg__exs">{examples(map).map((q) => <button key={q} className="vg__ex" onClick={() => ask(q)}>{q}</button>)}</div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className="vg__turn">
            <p className="vg__q">{t.q}</p>
            <div className="vg__msg">
              <Face mood={t.error ? "question" : !t.a ? "think" : "happy"} size={30} />
              {t.error ? <p className="vg__bub vg__err">Je n'ai pas pu répondre : {t.error}</p>
                : !t.a ? <p className="vg__bub vg__typing"><i /><i /><i /></p>
                : <div className="vg__bub"><Answer a={t.a} /></div>}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="vg__ask" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Qui peut exporter les données clients ?" disabled={busy} autoFocus />
        <button className="vl-btn vl-btn--primary vl-btn--sm" disabled={busy || !draft.trim()}>Demander</button>
      </form>
    </aside>
  );
}

/** La réponse : le texte, chaque `chemin:ligne` cliquable vers son code ; puis ce que Vigie a lu, et ce que ça a coûté. */
export function Answer({ a }: { a: VigieAnswer }) {
  const open = useOpenCode();
  const lines = a.answer.split("\n");
  return (
    <div className="vg__a">
      {lines.map((l, i) => <p key={i} className={/^\s*[-•]/.test(l) ? "vg__li" : ""}>{inline(l.replace(/^\s*[-•]\s*/, ""), open)}</p>)}
      <details className="vg__trace">
        <summary>Il a lu : {a.steps.map((s) => s.tool).join(", ") || "rien"}</summary>
        {a.steps.map((s, i) => <code key={i}>{s.tool} {Object.values(s.input).filter((v) => v !== "" && v !== undefined).map(String).join(" ")}</code>)}
      </details>
      <p className="vg__cost">{a.model}, {a.usage.turns} tours, {a.usage.seconds} s, {(a.usage.cost * 100).toFixed(1)} centimes</p>
    </div>
  );
}

/** Le texte de Vigie : les accents graves en code, les `chemin:ligne` en références cliquables. */
export function inline(text: string, open: (p: { path: string; line: number }) => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /`([^`]+)`|([\w./@()[\]-]+\.\w+):(\d+)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const ref = m[1].match(/^([\w./@()[\]-]+\.\w+):(\d+)$/);
      out.push(ref ? <CodeRef key={k++} proof={{ path: ref[1]!, line: Number(ref[2]) }} onOpen={open} /> : <code key={k++} className="rich">{m[1]}</code>);
    } else out.push(<CodeRef key={k++} proof={{ path: m[2]!, line: Number(m[3]) }} onOpen={open} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
