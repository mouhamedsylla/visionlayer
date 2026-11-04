import type { ReactNode } from "react";

/**
 * Le cadre d'une représentation : son nom technique, une phrase calculée sur ce projet (ce que fait cet objet, sa
 * conséquence), puis le dessin. Ni question, ni mode d'emploi : `code`, `question`, `reads` restent acceptés le temps de les retirer des écrans.
 */
export function Rep({ name, sentence, action, children, flush }: { code?: string; name: string; question?: string; sentence?: ReactNode; reads?: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className="lx-rep">
      <header className="lx-rep__head">
        <b>{name}</b>
        {action && <span className="lx-rep__action">{action}</span>}
      </header>
      {sentence && <p className="lx-rep__sentence">{sentence}</p>}
      <div className={flush ? "lx-rep__body lx-rep__body--flush" : "lx-rep__body"}>{children}</div>
    </section>
  );
}
