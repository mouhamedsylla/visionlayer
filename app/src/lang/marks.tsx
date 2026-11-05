import type { ReactNode } from "react";
import type { EdgeKind } from "../api/types";

/** Les marques du langage visuel (planche L1), accolées au fait qu'elles qualifient. */

/** Effet : ce qu'une étape fait au système. Écrire est plein, lire à filet, la mise en file pointillée, un refus porte son code. */
export function Effect({ kind, what }: { kind: EdgeKind | "refuse"; what: string }) {
  const word: Record<string, string> = { write: "Writes", read: "Reads", request: "Calls", call: "Calls", message: "Enqueues", trigger: "Triggers", use: "Uses", refuse: "Refuses" };
  return <span className={`lx-fx lx-fx--${kind}`}>{word[kind] ?? kind} {what}</span>;
}

/** Étape : le même numéro dans le déroulé et en marge du code. */
export const Step = ({ n, tone }: { n: number; tone?: "refuse" | "quiet" }) => <span className={`lx-step${tone ? ` lx-step--${tone}` : ""}`}>{n}</span>;

/** Moment : un groupe d'étapes titré, qui se replie. */
export function Moment({ title, count, open, toggle, children }: { title: string; count: number; open: boolean; toggle: () => void; children: ReactNode }) {
  return (
    <div className="lx-moment">
      <button className="lx-moment__head" onClick={toggle}><span className="vl-label">{title}</span><span className="lx-moment__n">{count} step{count > 1 ? "s" : ""} {open ? "▾" : "▸"}</span></button>
      {open && children}
    </div>
  );
}

/** Cadre de cohérence : pointillé autour des étapes qu'il protège (transaction, verrou, clé d'idempotence). */
export const Frame = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) =>
  <div className={`lx-frame${className ? ` ${className}` : ""}`}><span className="vl-tag vl-tag--neutral lx-frame__tag">{label}</span>{children}</div>;

/** Provenance : d'où vient un fait. Rien ne vient du modèle de langage. */
export function Provenance({ kind, who }: { kind: "read" | "declared" | "proposed" | "unread"; who?: string }) {
  const text = { read: "read from the code", declared: `declared${who ? `, ${who}` : ""}`, proposed: "proposed, pack not loaded", unread: "not read" }[kind];
  return <span className={`lx-prov lx-prov--${kind}`}><i />{text}</span>;
}

/** Gravité : toujours un libellé ; la couleur seule ne dit rien. */
export const Gravity = ({ tone }: { tone: "critical" | "signal" | "live" }) =>
  <span className={`vl-tag vl-tag--${tone}`}>{{ critical: "Finding", signal: "To watch", live: "Checked" }[tone]}</span>;

type Trait = "call" | "write" | "read" | "message" | "use";
/** Un lien (L1, les traits) : plein, il appelle ; épais, il écrit ; fin et gris, il lit ; tirets, il met en file ; pointillé, il importe sans pack. L'étiquette dit ce qui passe. */
export const Arrow = ({ kind = "call", label, back }: { kind?: Trait; label?: ReactNode; back?: boolean }) =>
  <span className={`lx-a lx-a--${kind}${back ? " lx-a--back" : ""}`}>{label && <span className="lx-a__label" title={typeof label === "string" ? label : undefined}>{label}</span>}<i /></span>;

/** Le même lien, de haut en bas, quand les deux bouts sont dans la même colonne. */
export const VArrow = ({ kind = "call", label }: { kind?: Trait; label?: ReactNode }) =>
  <span className={`lx-v lx-v--${kind}`}><i />{label && <span className="lx-a__label">{label}</span>}</span>;
