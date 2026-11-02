import { useId, useSyncExternalStore } from "react";
import { Bolt } from "./Bolt";

/**
 * Le visage de Vigie : un portrait dans une bulle, animé (il respire, cligne, regarde ailleurs quand il lit).
 * Ce sont des personnages dessinés, pas des personnes ; l'assistant derrière reste le même. Le choix se fait
 * dans Réglages et vaut pour cette personne, sur ce navigateur.
 */
export type Mood = "welcome" | "think" | "question" | "focus" | "wow" | "happy";

interface Persona {
  id: string; name: string; line: string;
  skin: [string, string, string]; // clair, base, ombre
  hair: string; style: "wrap" | "short" | "long" | "curls";
  shirt: string; bg: [string, string];
  wrap?: string; beard?: boolean; glasses?: boolean; earrings?: boolean;
}

export const PERSONAS: Persona[] = [
  { id: "awa", name: "Awa", line: "Calme et précise. Elle questionne avant de répondre.", skin: ["#b47a55", "#8d5a3b", "#6a412a"], hair: "#1d1410", style: "wrap", wrap: "#e2791d", earrings: true, shirt: "#1f3a5f", bg: ["#fbeee1", "#f3d6b8"] },
  { id: "malik", name: "Malik", line: "Le collègue qui relit derrière toi, lunettes sur le nez.", skin: ["#d9a57c", "#c08a62", "#9a6a47"], hair: "#1b1714", style: "short", beard: true, glasses: true, shirt: "#2f4f3e", bg: ["#e3f3e9", "#bfdfcb"] },
  { id: "ines", name: "Inès", line: "Directe, chaleureuse. Elle pousse tes hypothèses.", skin: ["#f6d7bd", "#ecc0a0", "#c99677"], hair: "#4a2c1d", style: "long", shirt: "#5a3e8c", bg: ["#ece8f6", "#d6cdee"] },
  { id: "kofi", name: "Kofi", line: "Patient. Il reprend depuis le test qui échoue.", skin: ["#7d5236", "#5c3a24", "#422819"], hair: "#120d0a", style: "curls", shirt: "#c58a1c", bg: ["#fbf3dc", "#f0dfae"] },
];
export const ROBOT = { id: "bolt", name: "Bolt", line: "Le robot des planches, pour qui préfère une machine." };

const KEY = "vl.vigie.face";
const subs = new Set<() => void>();
const read = () => { try { return localStorage.getItem(KEY) ?? "awa"; } catch { return "awa"; } };
export function setFace(id: string) { try { localStorage.setItem(KEY, id); } catch { /* sans stockage, le choix dure la page */ } current = id; subs.forEach((f) => f()); }
let current = read();
export const useFace = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => current);

/** Le visage choisi, dans sa bulle. `ring` dessine l'anneau qui tourne pendant que Vigie lit. */
export function Face({ mood = "welcome", size = 40, id, ring, night }: { mood?: Mood; size?: number; id?: string; ring?: boolean; night?: boolean }) {
  const chosen = useFace();
  const pid = id ?? chosen;
  const p = PERSONAS.find((x) => x.id === pid);
  return (
    <span className={`fc fc--${mood}${ring ? " fc--ring" : ""}${night ? " fc--night" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      {p ? <Portrait p={p} mood={mood} /> : <span className="fc__bolt"><Bolt mood={mood === "happy" || mood === "wow" ? "happy" : mood === "welcome" ? "welcome" : "think"} size={size * .9} night={night} /></span>}
    </span>
  );
}

function Portrait({ p, mood }: { p: Persona; mood: Mood }) {
  const u = useId().replace(/:/g, "");
  const [light, base, shade] = p.skin;
  const brow = { welcome: [0, 0], think: [-1, 1], question: [-3, 0], focus: [1.5, 1.5], wow: [-3, -3], happy: [-1, -1] }[mood];
  return (
    <svg viewBox="0 0 120 120" className="fc__svg">
      <defs>
        <radialGradient id={`bg${u}`} cx="50%" cy="30%" r="80%"><stop offset="0" stopColor={p.bg[0]} /><stop offset="1" stopColor={p.bg[1]} /></radialGradient>
        <radialGradient id={`sk${u}`} cx="42%" cy="36%" r="70%"><stop offset="0" stopColor={light} /><stop offset=".55" stopColor={base} /><stop offset="1" stopColor={shade} /></radialGradient>
        <linearGradient id={`sh${u}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.shirt} /><stop offset="1" stopColor={shade} stopOpacity=".9" /></linearGradient>
        <linearGradient id={`hr${u}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={p.hair} stopOpacity=".85" /><stop offset="1" stopColor={p.hair} /></linearGradient>
      </defs>
      <circle cx="60" cy="60" r="60" fill={`url(#bg${u})`} />
      {p.style === "long" && <path d="M34 54 C30 28 46 18 60 18 C76 18 90 28 86 56 C88 76 92 92 84 100 L36 100 C28 90 32 74 34 54Z" fill={`url(#hr${u})`} />}
      {p.style === "curls" && <g fill={p.hair}>{[[38, 36, 12], [50, 26, 13], [64, 24, 13], [78, 30, 12], [86, 44, 10], [34, 50, 9], [46, 36, 10], [72, 36, 10]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g>}
      <g className="fc__body">
        <path d="M10 124 C12 104 28 94 46 91 L74 91 C92 94 108 104 110 124Z" fill={`url(#sh${u})`} />
        <path d="M49 74 L48.5 92 Q60 99 71.5 92 L71 74Z" fill={shade} /><path d="M49 76 Q60 86 71 76 L71 80 Q60 90 49 80Z" fill="#000" opacity=".12" />
        <path d="M46 91 Q60 104 74 91" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="2" />
      </g>
      <g className="fc__head">
        <ellipse cx="37" cy="58" rx="4.5" ry="7" fill={base} /><ellipse cx="83" cy="58" rx="4.5" ry="7" fill={base} />
        {p.earrings && <><circle cx="37" cy="67" r="2.6" fill="#d9a420" /><circle cx="83" cy="67" r="2.6" fill="#d9a420" /></>}
        <path d="M38 50 C38 30 49 24 60 24 C71 24 82 30 82 50 C82 70 72 84 60 84 C48 84 38 70 38 50Z" fill={`url(#sk${u})`} />
        {p.beard && <path d="M40 58 C42 74 50 84 60 84 C70 84 78 74 80 58 C78 66 74 72 68 73 C63 70 57 70 52 73 C46 72 42 66 40 58Z" fill={p.hair} opacity=".88" />}
        {p.style === "short" && <path d="M38 50 C36 30 48 21 61 21 C75 21 85 30 82 50 C80 40 76 34 70 32 C62 35 50 34 44 32 C40 36 39 42 38 50Z" fill={`url(#hr${u})`} />}
        {p.style === "long" && <path d="M37 52 C36 30 48 20 61 20 C76 20 85 31 83 52 C78 40 70 31 60 30 C56 38 46 44 37 52Z" fill={`url(#hr${u})`} />}
        {p.style === "curls" && <path d="M38 48 C38 32 48 26 60 26 C72 26 82 32 82 48 C78 38 70 34 60 34 C50 34 42 38 38 48Z" fill={p.hair} />}
        {p.style === "wrap" && <>
          <path d="M34 52 C26 22 46 6 61 7 C80 8 95 22 86 52 C82 42 72 37 60 37 C48 37 38 42 34 52Z" fill={p.wrap} />
          <path d="M38 34 C50 24 72 24 84 34 M36 43 C50 34 72 34 86 43 M46 14 C56 22 68 22 78 14" fill="none" stroke="rgba(0,0,0,.15)" strokeWidth="2" strokeLinecap="round" />
          <path d="M64 9 C74 -2 92 4 88 18 C82 12 72 11 64 9Z" fill={p.wrap} /><path d="M66 9 C76 3 86 6 86 13" fill="none" stroke="rgba(0,0,0,.15)" strokeWidth="1.6" />
          {[[44, 26], [56, 18], [70, 19], [80, 27], [50, 33], [70, 31]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.5" fill="#fff" opacity=".45" />)}
        </>}
        <g className="fc__brows" fill="none" stroke={p.hair} strokeWidth="2.6" strokeLinecap="round">
          <path d={`M44 ${46 + brow[0]!} Q50 ${43 + brow[0]!} 56 ${46 + brow[0]! * .4}`} />
          <path d={`M64 ${46 + brow[1]! * .4} Q70 ${43 + brow[1]!} 76 ${46 + brow[1]!}`} />
        </g>
        <g className="fc__eyes">
          {[50, 70].map((x) => (
            <g key={x}>
              <path d={`M${x - 6.5} 54 Q${x} ${mood === "wow" ? 46 : 48.5} ${x + 6.5} 54 Q${x} ${mood === "happy" ? 56 : 58.5} ${x - 6.5} 54Z`} fill="#fbfaf7" />
              <g className="fc__look"><circle cx={x} cy="53.6" r="3.4" fill="#3b2516" /><circle cx={x} cy="53.6" r="1.7" fill="#0d0907" /><circle cx={x + 1.2} cy="52.4" r=".9" fill="#fff" /></g>
              <path d={`M${x - 6.8} 54 Q${x} ${mood === "focus" ? 50 : 48} ${x + 6.8} 54`} fill="none" stroke={shade} strokeWidth="1.4" />
            </g>
          ))}
        </g>
        {p.glasses && <g fill="none" stroke="#1b1714" strokeWidth="1.8"><rect x="41.5" y="47" width="17" height="13" rx="5" /><rect x="61.5" y="47" width="17" height="13" rx="5" /><path d="M58.5 52 Q60 50.5 61.5 52 M41.5 52 L38 50 M78.5 52 L82 50" /></g>}
        <path d="M59.6 58 Q57.6 64.6 58.4 66.4 Q60.4 67.8 62.6 66.6" fill="none" stroke={shade} strokeWidth="1.3" strokeLinecap="round" opacity=".85" /><ellipse cx="60.6" cy="63" rx="1.3" ry="3" fill="#fff" opacity=".12" />
        <ellipse cx="46" cy="66" rx="5" ry="3" fill="#e2591d" opacity=".1" /><ellipse cx="74" cy="66" rx="5" ry="3" fill="#e2591d" opacity=".1" />
        <Mouth mood={mood} lip={shade} />
      </g>
    </svg>
  );
}

function Mouth({ mood, lip }: { mood: Mood; lip: string }) {
  if (mood === "wow") return <ellipse cx="60" cy="74" rx="3.6" ry="4.2" fill="#5a2a22" stroke={lip} strokeWidth="1" />;
  if (mood === "happy") return <g><path d="M51 71 Q60 82 69 71 Q60 75 51 71Z" fill="#5a2a22" /><path d="M53 71.6 Q60 74.4 67 71.6 L66 73 Q60 75 54 73Z" fill="#fff" /></g>;
  if (mood === "welcome") return <path d="M52 72 Q60 79 68 72" fill="none" stroke="#7a3a2c" strokeWidth="2.4" strokeLinecap="round" />;
  if (mood === "question") return <path d="M53 74 Q59 76 67 72" fill="none" stroke="#7a3a2c" strokeWidth="2.2" strokeLinecap="round" />;
  if (mood === "focus") return <path d="M54 74 L66 74" stroke="#7a3a2c" strokeWidth="2.2" strokeLinecap="round" />;
  return <path className="fc__talk" d="M55 74 Q60 76 65 74" fill="none" stroke="#7a3a2c" strokeWidth="2.2" strokeLinecap="round" />;
}
