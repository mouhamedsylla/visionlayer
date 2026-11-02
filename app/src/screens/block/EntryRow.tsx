import type { Entrypoint } from "../../api/types";

const GUARD: Record<string, string> = { public: "ouverte", authenticated: "connexion", role: "rôle", signature: "signée", internal: "interne", unknown: "garde non reconnue" };

/** Une ligne de point d'entrée : son verbe et sa clé, sa garde, le nombre d'étapes de son déroulé ; elle ouvre le déroulé. */
export function EntryRow({ e, open }: { e: Entrypoint; open: () => void }) {
  const [verb, ...rest] = e.kind === "http" ? e.key.split(" ") : [e.kind === "schedule" ? "CRON" : e.kind.toUpperCase(), e.key];
  return (
    <button className="entry" onClick={open}>
      <span className="entry__key"><span className={`vl-method${/^(GET|HEAD|OPTIONS)$/.test(verb!) ? " vl-method--read" : ""}`}>{verb}</span><code>{rest.join(" ")}</code></span>
      <span className="entry__fn mono">{e.handler?.name ?? ""}</span>
      {e.access ? <span className={`entry__guard entry__guard--${e.access.level}`}>{GUARD[e.access.level]}</span> : <span />}
      <span className="entry__steps mono">{e.flow?.length ? `${e.flow.length} étapes ›` : "aucun effet lu ›"}</span>
    </button>
  );
}
