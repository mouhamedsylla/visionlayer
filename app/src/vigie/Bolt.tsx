/**
 * Bolt, le visage de Vigie (planche VigieFiche) : une tête-écran, une antenne, un bras. Ses humeurs se lisent
 * sur l'écran. Le dessin est celui des planches, au trait près ; `night` le pose sur une carte noire.
 */
export type Mood = "welcome" | "think" | "happy";

export function Bolt({ mood = "welcome", night, size = 150 }: { mood?: Mood; night?: boolean; size?: number }) {
  const line = night ? "#f5f4f1" : "#121211", fill = night ? "#2a2a27" : "#f5f4f1", foot = night ? "#f5f4f1" : "#121211";
  return (
    <svg width={size} height={Math.round(size * 184 / 160)} viewBox="0 0 160 184" aria-hidden="true" className="bolt">
      <ellipse cx="80" cy="178" rx="34" ry="5" fill={night ? "#000" : "#121211"} opacity={night ? .4 : .12} />
      <path d="M80 30V15" stroke={line} strokeWidth="4" strokeLinecap="round" /><circle cx="80" cy="11" r="7" fill="#e2791d" stroke={line} strokeWidth="3" />
      <rect x="18" y="54" width="14" height="28" rx="6" fill="#c8c5bf" stroke={line} strokeWidth="3" /><rect x="128" y="54" width="14" height="28" rx="6" fill="#c8c5bf" stroke={line} strokeWidth="3" />
      <rect x="30" y="28" width="100" height="80" rx="24" fill={fill} stroke={line} strokeWidth="3.5" />
      <rect x="42" y="40" width="76" height="56" rx="16" fill="#141413" />
      {mood === "welcome" && <><ellipse cx="64" cy="66" rx="7" ry="9" fill="#f5f4f1" /><circle cx="66.5" cy="63" r="2.2" fill="#141413" /><ellipse cx="96" cy="66" rx="7" ry="9" fill="#f5f4f1" /><circle cx="98.5" cy="63" r="2.2" fill="#141413" /><path d="M71 80 q9 8 18 0" stroke="#f5f4f1" strokeWidth="3" fill="none" strokeLinecap="round" /></>}
      {mood === "think" && <><ellipse cx="64" cy="66" rx="7" ry="9" fill="#f5f4f1" /><circle cx="66.5" cy="63" r="2.2" fill="#141413" /><ellipse cx="96" cy="67" rx="7" ry="6" fill="#f5f4f1" /><circle cx="98" cy="66" r="2" fill="#141413" /><path d="M88 54 l14 -4" stroke="#f5f4f1" strokeWidth="3" strokeLinecap="round" /><circle cx="82" cy="82" r="3.5" fill="none" stroke="#f5f4f1" strokeWidth="2.5" /></>}
      {mood === "happy" && <><path d="M57 68 q7 -9 14 0 M89 68 q7 -9 14 0" stroke="#f5f4f1" strokeWidth="3.5" fill="none" strokeLinecap="round" /><path d="M69 78 q11 12 22 0" stroke="#f5f4f1" strokeWidth="3" fill="none" strokeLinecap="round" /></>}
      <circle cx="52" cy="84" r="4" fill="#e2791d" opacity=".85" /><circle cx="108" cy="84" r="4" fill="#e2791d" opacity=".85" />
      <rect x="68" y="107" width="24" height="9" rx="3" fill="#c8c5bf" stroke={line} strokeWidth="3" />
      <path d="M44 126 q-14 6 -16 20" stroke={line} strokeWidth="5" fill="none" strokeLinecap="round" /><circle cx="27" cy="149" r="7" fill={fill} stroke={line} strokeWidth="3" />
      {mood === "welcome"
        ? <><path d="M116 126 q16 -6 20 -26" stroke={line} strokeWidth="5" fill="none" strokeLinecap="round" /><circle cx="137" cy="97" r="7" fill={fill} stroke={line} strokeWidth="3" /></>
        : <><path d="M116 126 q14 6 16 20" stroke={line} strokeWidth="5" fill="none" strokeLinecap="round" /><circle cx="133" cy="149" r="7" fill={fill} stroke={line} strokeWidth="3" /></>}
      <rect x="44" y="114" width="72" height="52" rx="20" fill={fill} stroke={line} strokeWidth="3.5" />
      <circle cx="80" cy="138" r="7" fill="#2c9a57" stroke={line} strokeWidth="2.5" />
      <rect x="54" y="164" width="18" height="10" rx="5" fill={foot} /><rect x="88" y="164" width="18" height="10" rx="5" fill={foot} />
    </svg>
  );
}
