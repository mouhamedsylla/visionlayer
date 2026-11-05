import type { ReactNode } from "react";
import type { Entrypoint, TechLabel } from "../api/types";

/**
 * Les 12 objets du langage visuel (planche L1, “Le vocabulaire commun”) : chaque objet du modèle neutre a
 * une seule forme, sur tous les écrans. Un écran compose ces objets ; il n'en dessine jamais d'autres.
 */

/** Le logo d'une technologie (Simple Icons) dans son carré noir, ou ses deux premières lettres. */
export function Mono({ tech, name, muted }: { tech?: TechLabel; name: string; muted?: boolean }) {
  return (
    <span className={`lx-mg${muted ? " lx-mg--muted" : ""}`} title={tech?.name}>
      {tech?.icon ? <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d={tech.icon} fill="currentColor" /></svg> : (tech?.name ?? name).slice(0, 2).toUpperCase()}
    </span>
  );
}

type Card = { name: string; tech?: TechLabel; meta?: string; extra?: ReactNode; on?: boolean; far?: boolean; onClick?: () => void; onDoubleClick?: () => void; title?: string; children?: ReactNode };

/** Déployable : carte blanche à filet, logo, nom, nombre d'exemplaires, compteurs mono. */
export function Deployable({ name, tech, meta, extra, on, far, onClick, onDoubleClick, title, children }: Card) {
  return (
    <button className={`lx-node${on ? " is-on" : ""}${far ? " is-far" : ""}`} onClick={onClick} onDoubleClick={onDoubleClick} title={title}>
      <span className="lx-node__head"><Mono tech={tech} name={name} /><b>{name}</b>{extra}</span>
      {meta && <span className="lx-node__meta">{meta}</span>}
      {children}
    </button>
  );
}

/** Client : la même carte, coin supérieur coupé ; ce que les gens ouvrent. */
export function Client(p: Card) {
  return (
    <button className={`lx-node lx-node--client${p.on ? " is-on" : ""}${p.far ? " is-far" : ""}`} onClick={p.onClick} title={p.title}>
      <span className="lx-node__head"><Mono tech={p.tech} name={p.name} /><b>{p.name}</b>{p.extra}</span>
      {p.meta && <span className="lx-node__meta">{p.meta}</span>}
      {p.children}
    </button>
  );
}

/** Service extérieur : fond en retrait, étiquette EXTÉRIEUR, et ce que le système en attend. */
export function External(p: Card) {
  return (
    <button className={`lx-node lx-node--ext${p.on ? " is-on" : ""}${p.far ? " is-far" : ""}`} onClick={p.onClick} title={p.title}>
      <span className="lx-node__head"><Mono tech={p.tech} name={p.name} muted /><b>{p.name}</b><span className="vl-tag vl-tag--neutral">External</span></span>
      {p.meta && <span className="lx-node__meta">{p.meta}</span>}
      {p.children}
    </button>
  );
}

const GLYPH = {
  store: <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><ellipse cx="8" cy="4" rx="5" ry="1.8" /><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8S13 9 13 8" /></svg>,
  queue: <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m3 4 4 4-4 4M9 4l4 4-4 4" /></svg>,
  table: <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="2.5" y="3" width="11" height="10" rx="1" /><path d="M2.5 6.5h11M6.5 6.5V13" /></svg>,
  clock: <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.2l2 1.3" /></svg>,
};

/** Ressource gérée : carte basse au rayon 8, glyphe du genre (base, file), son compteur. */
export function Resource({ name, kind, meta, on, far, onClick, children }: { name: string; kind: "store" | "queue"; meta?: string; on?: boolean; far?: boolean; onClick?: () => void; children?: ReactNode }) {
  return (
    <button className={`lx-node lx-node--res${on ? " is-on" : ""}${far ? " is-far" : ""}`} onClick={onClick}>
      <span className="lx-node__head">{GLYPH[kind]}<b>{name}</b>{meta && <span className="lx-node__count">{meta}</span>}</span>
      {children}
    </button>
  );
}

/** Composant : plein pour un contrat lu dans le code, pointillé pour un composant calculé. */
export function Component({ name, contract, on, far, onClick, children }: { name: string; contract?: boolean; on?: boolean; far?: boolean; onClick?: () => void; children?: ReactNode }) {
  return (
    <button className={`lx-comp${contract ? " lx-comp--contract" : ""}${on ? " is-on" : ""}${far ? " is-far" : ""}`} onClick={onClick}>
      <b>{name}</b>{children}
    </button>
  );
}

/** Fonction : son nom en mono, puce en retrait. */
export const Fn = ({ name, onClick }: { name: string; onClick?: () => void }) => <span className={`lx-fn${onClick ? " is-link" : ""}`} onClick={onClick}>{name}</span>;

const GUARD: Record<string, string> = { public: "ouverte", authenticated: "connexion", role: "role", signature: "signed", internal: "interne", unknown: "guard not read" };

/** Point d'entrée : méthode en badge et route, ou horloge et nom pour une tâche ; sa garde en marque. */
export function Entry({ e, guard = true, onClick }: { e: Entrypoint; guard?: boolean; onClick?: () => void }) {
  const http = e.kind === "http" || e.kind === "rpc";
  const [verb, ...rest] = e.key.split(" ");
  const by = e.access?.by?.name;
  return (
    <span className={`lx-entry${onClick ? " is-link" : ""}`} onClick={onClick}>
      {http ? <><span className={`vl-method${/^(GET|HEAD|OPTIONS)$/.test(verb!) ? " vl-method--read" : ""}`}>{verb}</span><span className="lx-entry__key">{rest.join(" ")}</span></>
        : e.kind === "schedule" ? <>{GLYPH.clock}<span className="lx-entry__key">{e.handler?.name ?? "task"}</span><span className="lx-entry__cron">{e.key}</span></>
        : <>{GLYPH.queue}<span className="lx-entry__key">{e.key}</span></>}
      {guard && e.access && <span className={`vl-tag ${e.access.level === "unknown" ? "vl-tag--signal" : "vl-tag--neutral"}`}>{by ?? GUARD[e.access.level]}</span>}
    </span>
  );
}

/** Entité, file : puce mono à glyphe ; grille pour une table, chevrons pour une file ou un sujet. */
export const Entity = ({ name, kind = "table", write, onClick }: { name: string; kind?: "table" | "queue"; write?: boolean; onClick?: () => void }) =>
  <span className={`lx-chip${write ? " lx-chip--w" : ""}${onClick ? " is-link" : ""}`} onClick={onClick}>{kind === "table" ? GLYPH.table : GLYPH.queue}{name}</span>;

/** Acteur : un rond ; personne, rôle (plein), service ou fournisseur (en retrait). */
export function Actor({ label, kind, initials }: { label: string; kind: "person" | "role" | "service"; initials: string }) {
  return <span className="lx-actor"><span className={`lx-actor__dot lx-actor__dot--${kind}`}>{initials}</span><span>{label}</span></span>;
}

/** État d'une donnée : pastille ; noire pour un état final, pointillée pour une valeur jamais écrite. */
export const State = ({ value, final, never }: { value: string; final?: boolean; never?: boolean }) =>
  <span className={`lx-state${final ? " lx-state--final" : ""}${never ? " lx-state--never" : ""}`}>{value}</span>;

/** Temps : un axe horizontal de 24 h, heures en mono ; chaque passage est une case. */
export function TimeAxis({ ticks, fill }: { ticks: number[]; fill?: boolean }) {
  return (
    <span className="lx-time">
      <span className="lx-time__line">{fill ? <i className="lx-time__fill" /> : ticks.map((h, i) => <i key={i} style={{ left: `${(h / 24) * 100}%` }} />)}</span>
    </span>
  );
}
