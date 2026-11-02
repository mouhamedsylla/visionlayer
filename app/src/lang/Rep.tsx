import type { ReactNode } from "react";

/**
 * Le cadre d'une représentation du catalogue (planche L2) : son code et son nom, la question à laquelle elle
 * répond, une phrase qui dit ce qu'on voit, le dessin, puis « Se lit » : comment le lire.
 */
export function Rep({ code, name, question, sentence, reads, action, children, flush }: { code: string; name: string; question: string; sentence?: ReactNode; reads: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className="lx-rep">
      <header className="lx-rep__head">
        <span className="lx-rep__code">{code}</span><b>{name}</b><span className="lx-rep__q">{question}</span>
        {action && <span className="lx-rep__action">{action}</span>}
      </header>
      {sentence && <p className="lx-rep__sentence">{sentence}</p>}
      <div className={flush ? "lx-rep__body lx-rep__body--flush" : "lx-rep__body"}>{children}</div>
      <p className="lx-rep__reads"><b>Se lit</b> {reads}</p>
    </section>
  );
}
