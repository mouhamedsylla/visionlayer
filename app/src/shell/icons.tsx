/** Les icônes des planches : trait de 1,5 px, 16 px. */
const P = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, "aria-hidden": true } as const;

export const Icon = {
  vue: <svg {...P}><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></svg>,
  carte: <svg {...P}><rect x="2" y="2.5" width="5" height="4" rx="1" /><rect x="9" y="9.5" width="5" height="4" rx="1" /><path d="M4.5 6.5v5H9" /></svg>,
  fonctionnalites: <svg {...P}><path d="M2.5 4h4M2.5 8h7M2.5 12h4" /><path d="m8.5 2.5 1.5 1.5-1.5 1.5M11.5 6.5 13 8l-1.5 1.5M8.5 10.5 10 12l-1.5 1.5" /></svg>,
  parcours: <svg {...P}><circle cx="3.5" cy="3.5" r="1.5" /><circle cx="12.5" cy="8" r="1.5" /><circle cx="3.5" cy="12.5" r="1.5" /><path d="M5 3.5h3.5a2 2 0 0 1 2 2V6.5M11 8H8M5 12.5h3.5a2 2 0 0 0 2-2V9.5" /></svg>,
  mecanismes: <svg {...P}><rect x="6" y="2.5" width="4" height="3.5" rx="1" /><path d="M8 6v2.5M4 8.5h8M4 8.5V10M12 8.5V10" /><rect x="2" y="10" width="4" height="3.5" rx="1" /><rect x="10" y="10" width="4" height="3.5" rx="1" strokeDasharray="2 1.5" /></svg>,
  acces: <svg {...P}><rect x="3.5" y="7" width="9" height="6.5" rx="1" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>,
  donnees: <svg {...P}><ellipse cx="8" cy="4" rx="5" ry="1.8" /><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8S13 9 13 8" /></svg>,
  taches: <svg {...P}><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.2l2 1.3" /></svg>,
  regles: <svg {...P}><path d="M4 2.5h8v11l-4-2.5-4 2.5z" /></svg>,
  agents: <svg {...P}><rect x="3" y="5" width="10" height="8" rx="2" /><path d="M8 2.5V5M6 9h.01M10 9h.01" /></svg>,
  packs: <svg {...P}><path d="m8 2 5.5 3v6L8 14l-5.5-3V5z" /><path d="M8 8v6M8 8l5.5-3M8 8 2.5 5" /></svg>,
  couverture: <svg {...P}><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" /><path d="M2.5 8h11M8 2.5v11" strokeDasharray="2 1.5" /></svg>,
  replays: <svg {...P}><circle cx="8" cy="8" r="5.5" /><path d="M7 5.5 10 8l-3 2.5z" /></svg>,
  reglages: <svg {...P}><circle cx="8" cy="8" r="2" /><path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M3.6 12.4l1.2-1.2M11.2 4.8l1.2-1.2" /></svg>,
  side: <svg {...P} width="16" height="16"><rect x="2.5" y="2.5" width="11" height="11" rx="2" /><path d="M6.5 2.5v11" /></svg>,
  search: <svg {...P} width="14" height="14"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg>,
  refresh: <svg {...P}><path d="M13 8a5 5 0 1 1-1.5-3.5M13 3v2.5h-2.5" /></svg>,
  comment: <svg {...P}><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" /></svg>,
  plus: <svg {...P}><path d="M8 3v10M3 8h10" /></svg>,
  down: <svg {...P}><path d="m4 6 4 4 4-4" /></svg>,
  vigie: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#f5f4f1" strokeWidth="1.5" aria-hidden="true"><circle cx="8" cy="8" r="2.2" /><path d="M8 1.5v2.5M8 12v2.5M1.5 8H4M12 8h2.5" /></svg>,
  close: <svg {...P} width="14" height="14"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></svg>,
};

/** Le logo « points aux blocs » des planches. */
export const Logo = (
  <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="8" fill="#121211" /><g fill="#f5f4f1"><circle cx="7.5" cy="9" r="1.4" opacity=".45" /><circle cx="7.5" cy="15" r="1.4" opacity=".7" /><circle cx="7.5" cy="21" r="1.4" /><circle cx="11.5" cy="9" r="1.4" opacity=".7" /><circle cx="11.5" cy="15" r="1.4" /><circle cx="11.5" cy="21" r="1.4" /><rect x="16" y="7.5" width="8" height="6" rx="1.5" /></g><rect x="16" y="16.5" width="8" height="6" rx="1.5" fill="#a29f99" /><path d="M20 13.5v3" stroke="#f5f4f1" strokeWidth="1.2" /></svg>
);
