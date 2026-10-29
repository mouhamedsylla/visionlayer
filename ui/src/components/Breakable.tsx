import { Fragment } from "react";

/**
 * Un nom tiré du code, qui ne se coupe qu'à ses jointures : avant une majuscule
 * interne (`stripe·Webhook`), après `_`, `.`, `/` ou `-`. Jamais au milieu d'un mot.
 */
export function Breakable({ text }: { text: string }) {
  const parts = text.split(/(?<=[_./-])|(?<=[a-z0-9])(?=[A-Z])/);
  return <>{parts.map((p, i) => <Fragment key={i}>{i > 0 && <wbr />}{p}</Fragment>)}</>;
}
