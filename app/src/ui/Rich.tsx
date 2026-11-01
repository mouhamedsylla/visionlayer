/** Un texte du moteur, où `nom` marque du code : rendu en mono, sans les accents graves. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/);
  return <>{parts.map((p, i) => (i % 2 ? <code key={i} className="rich">{p}</code> : p))}</>;
}
