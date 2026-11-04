import type { ReactNode } from "react";

/**
 * Le cadre d'une représentation : son nom technique et le dessin. On regarde et on comprend : ni question, ni phrase
 * qui récite ce que le dessin montre. Les autres propriétés restent acceptées le temps de les retirer des écrans.
 */
export function Rep({ name, action, children, flush }: { code?: string; name: string; question?: string; sentence?: ReactNode; reads?: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className="lx-rep">
      <header className="lx-rep__head">
        <b>{name}</b>
        {action && <span className="lx-rep__action">{action}</span>}
      </header>
      <div className={flush ? "lx-rep__body lx-rep__body--flush" : "lx-rep__body"}>{children}</div>
    </section>
  );
}
