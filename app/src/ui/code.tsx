import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { Proof, SourceExcerpt } from "../api/types";
import { Icon } from "../shell/icons";
import "./code.css";

type Open = (p: Pick<Proof, "path" | "line">) => void;
const Ctx = createContext<Open>(() => {});

/** Ouvre le code d'une preuve sur place (C3) : le passage sur fond nuit, la ligne surlignée, les secrets masqués. */
export const useOpenCode = () => useContext(Ctx);

export function CodeProvider({ children }: { children: ReactNode }) {
  const [at, setAt] = useState<Pick<Proof, "path" | "line">>();
  const [excerpt, setExcerpt] = useState<SourceExcerpt>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!at) return;
    setExcerpt(undefined); setError(undefined);
    const from = Math.max(1, at.line - 12);
    api.source(at.path, from, at.line + 28).then(setExcerpt).catch((e) => setError(String(e.message ?? e)));
  }, [at]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAt(undefined);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);
  return (
    <Ctx.Provider value={setAt}>
      {children}
      {at && (
        <aside className="code" aria-label="Code">
          <header className="code__head">
            <span className="mono">{at.path}<b>:{at.line}</b></span>
            <button type="button" className="vl-btn vl-btn--ghost-night vl-btn--sm" onClick={() => setAt(undefined)} aria-label="Close">{Icon.close}</button>
          </header>
          {error && <p className="code__err">{error}</p>}
          {excerpt && (
            <pre className="code__body">
              {excerpt.lines.map((l, i) => {
                const n = excerpt.from + i;
                return <div key={n} className={n === at.line ? "code__line code__line--on" : "code__line"}><span className="code__n">{n}</span>{l || " "}</div>;
              })}
            </pre>
          )}
        </aside>
      )}
    </Ctx.Provider>
  );
}
