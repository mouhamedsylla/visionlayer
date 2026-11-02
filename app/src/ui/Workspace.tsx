import type { ReactNode } from "react";

/** Le cadre des écrans de lecture (Carte, bloc, déroulé) : l'en-tête reste en place, la toile et le panneau défilent chacun. */
export function Workspace({ head, panel, children, panelWidth }: { head: ReactNode; panel?: ReactNode; children: ReactNode; panelWidth?: number }) {
  return (
    <div className="ws">
      <div className="ws__head">{head}</div>
      <div className="ws__body" style={panel ? (panelWidth ? { ["--ws-panel" as string]: `${panelWidth}px` } : undefined) : { gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div className="ws__canvas">{children}</div>
        {panel && <aside className="ws__panel">{panel}</aside>}
      </div>
    </div>
  );
}
