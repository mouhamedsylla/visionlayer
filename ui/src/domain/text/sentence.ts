/**
 * Une phrase qui commence par une majuscule, sauf si son premier mot est un
 * nom tiré du code (`expireHolds`, `users.role`, `« POST /auth »`) : il reste
 * tel qu'écrit.
 */
export function sentence(text: string): string {
  const first = text.split(/\s/)[0] ?? "";
  if (/[A-Z._$/«]|\d/.test(first)) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
