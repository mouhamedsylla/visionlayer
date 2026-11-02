import { useId } from "react";

/**
 * Le visage de Vigie : le robot des planches, en relief, dans une bulle. Coque de métal clair, visière de verre,
 * yeux de lumière qui disent l'humeur ; il flotte, cligne, balaie sa visière quand il lit, et salue de la main.
 */
export type Mood = "welcome" | "think" | "question" | "focus" | "wow" | "happy";

export function Face({ mood = "welcome", size = 40, ring, night }: { mood?: Mood; size?: number; ring?: boolean; night?: boolean }) {
  const u = useId().replace(/:/g, "");
  return (
    <span className={`fc fc--${mood}${ring ? " fc--ring" : ""}${night ? " fc--night" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 120 120" className="fc__svg">
        <defs>
          <radialGradient id={`bg${u}`} cx="50%" cy="35%" r="75%"><stop offset="0" stopColor={night ? "#3a3833" : "#fdf3e8"} /><stop offset="1" stopColor={night ? "#1b1a18" : "#f1d3b3"} /></radialGradient>
          <linearGradient id={`mt${u}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".55" stopColor="#e9e6e0" /><stop offset="1" stopColor="#c4bfb6" /></linearGradient>
          <linearGradient id={`ms${u}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#b9b4ab" /><stop offset=".5" stopColor="#efece6" /><stop offset="1" stopColor="#a9a39a" /></linearGradient>
          <radialGradient id={`gl${u}`} cx="45%" cy="30%" r="85%"><stop offset="0" stopColor="#34332f" /><stop offset="1" stopColor="#0b0b0a" /></radialGradient>
          <radialGradient id={`an${u}`} cx="35%" cy="35%" r="70%"><stop offset="0" stopColor="#ffc58a" /><stop offset="1" stopColor="#e2791d" /></radialGradient>
          <filter id={`gw${u}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <circle cx="60" cy="60" r="60" fill={`url(#bg${u})`} />
        <ellipse cx="60" cy="116" rx="34" ry="5" fill="#000" opacity=".1" />
        <g className="fc__bot">
          <path d="M26 122 C26 104 38 94 60 94 C82 94 94 104 94 122Z" fill={`url(#mt${u})`} stroke="#8f897f" strokeWidth="1" />
          <circle cx="60" cy="108" r="5" fill="#2c9a57" className="fc__core" /><circle cx="58.6" cy="106.6" r="1.6" fill="#fff" opacity=".7" />
          <rect x="52" y="86" width="16" height="10" rx="3" fill={`url(#ms${u})`} />
          <g className="fc__arm"><path d="M90 104 Q102 96 104 82" fill="none" stroke="#b9b4ab" strokeWidth="6" strokeLinecap="round" /><circle cx="104.5" cy="79" r="5.5" fill={`url(#mt${u})`} stroke="#8f897f" strokeWidth="1" /></g>
          <g className="fc__ant"><path d="M60 28 V17" stroke="#8f897f" strokeWidth="2.6" strokeLinecap="round" /><circle cx="60" cy="13" r="5" fill={`url(#an${u})`} className="fc__bulb" /></g>
          <rect x="17" y="47" width="9" height="24" rx="4.5" fill={`url(#ms${u})`} stroke="#8f897f" strokeWidth="1" /><rect x="94" y="47" width="9" height="24" rx="4.5" fill={`url(#ms${u})`} stroke="#8f897f" strokeWidth="1" />
          <rect x="22" y="27" width="76" height="62" rx="22" fill={`url(#mt${u})`} stroke="#8f897f" strokeWidth="1.2" />
          <path d="M32 33 Q46 28 62 29" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".9" />
          <rect x="30" y="37" width="60" height="43" rx="15" fill={`url(#gl${u})`} />
          <path d="M36 42 Q44 38 54 39 L40 70 Q34 60 36 42Z" fill="#fff" opacity=".06" />
          <g className="fc__face" filter={`url(#gw${u})`}><Eyes mood={mood} /></g>
          <circle cx="37" cy="72" r="3" fill="#e2791d" opacity=".55" /><circle cx="83" cy="72" r="3" fill="#e2791d" opacity=".55" />
        </g>
      </svg>
    </span>
  );
}

const LED = "#7ef0b4";

/** Les yeux et la bouche, en lumière sur la visière : chaque humeur a son dessin. */
function Eyes({ mood }: { mood: Mood }) {
  const mouth = { welcome: "M53 71 Q60 76 67 71", think: "M56 73 L64 73", question: "M54 73 Q60 71 66 74", focus: "M55 73 L65 73", wow: "", happy: "M51 70 Q60 79 69 70" }[mood];
  return (
    <>
      <g className="fc__eyes">
        {mood === "happy" ? <path d="M43 61 Q49 52 55 61 M65 61 Q71 52 77 61" fill="none" stroke={LED} strokeWidth="3.4" strokeLinecap="round" />
          : mood === "focus" ? <><rect x="43" y="56" width="12" height="4" rx="2" fill={LED} /><rect x="65" y="56" width="12" height="4" rx="2" fill={LED} /></>
          : mood === "wow" ? <><circle cx="49" cy="57" r="6.5" fill={LED} /><circle cx="71" cy="57" r="6.5" fill={LED} /></>
          : mood === "question" ? <><rect x="44.5" y="50" width="9" height="13" rx="4.5" fill={LED} /><rect x="66.5" y="54" width="9" height="8" rx="4" fill={LED} /></>
          : <g className="fc__look"><rect x="44.5" y="50" width="9" height="14" rx="4.5" fill={LED} /><rect x="66.5" y="50" width="9" height="14" rx="4.5" fill={LED} /></g>}
      </g>
      {mood === "wow" ? <circle cx="60" cy="73" r="3" fill="none" stroke={LED} strokeWidth="2.4" /> : <path className="fc__mouth" d={mouth} fill="none" stroke={LED} strokeWidth="2.6" strokeLinecap="round" />}
    </>
  );
}
