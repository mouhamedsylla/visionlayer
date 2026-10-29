/** Le logo, piste D « des points aux blocs » (choisie le 01/10) : des lignes de code lues, un lien prouvé, deux blocs. */
const COLUMNS = [6, 12, 18];
const ROWS = [9, 16.5, 24, 31.5, 39];
const OPACITY = [0.25, 0.53, 0.8];

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {ROWS.flatMap((y) => COLUMNS.map((x, i) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="currentColor" fillOpacity={OPACITY[i]} />))}
      <path d="M23 24h5" stroke="currentColor" strokeWidth="1.6" strokeDasharray="1.6 1.6" />
      <rect x="31" y="7" width="12" height="10" fill="currentColor" />
      <rect x="31" y="31" width="12" height="10" fill="var(--blue)" />
      <path d="M37 17V31" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}
