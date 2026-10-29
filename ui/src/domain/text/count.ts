/**
 * Un titre et son compte final séparés : `Parle à · 3` → « Parle à » et `3`.
 * Un titre sans nombre à la fin est rendu tel quel.
 */
export function splitCount(title: string): { label: string; count?: string } {
  const m = title.match(/^(.*\S)\s+·\s+(\d+)$/);
  // `Lue par · 3 · écrite par · 2` porte deux comptes : il reste entier.
  return m && !/·\s+\d/.test(m[1]!) ? { label: m[1]!, count: m[2]! } : { label: title };
}
