import type { TechLabel } from "../api/types";

/** Le logo d'une technologie (Simple Icons, monochrome), ou ses deux premières lettres. */
export function TechLogo({ tech, size = 22, night = false }: { tech?: TechLabel; size?: number; night?: boolean }) {
  const cls = `logo${night ? " logo--night" : ""}`;
  if (!tech) return <span className={cls} style={{ width: size, height: size }} />;
  return (
    <span className={cls} style={{ width: size, height: size }} title={tech.name}>
      {tech.icon
        ? <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} aria-hidden="true"><path d={tech.icon} /></svg>
        : <span className="logo__mono">{tech.name.slice(0, 2)}</span>}
    </span>
  );
}
