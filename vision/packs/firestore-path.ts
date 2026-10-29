/**
 * Chemins Firestore (https://firebase.google.com/docs/firestore/data-model) :
 * collection / document / collection / document… Un segment calculé ou un
 * joker (`{uid}`) devient `{}`.
 *
 *   collectionOf(["users", "{}", "wallet", "main"]) → "users/{}/wallet"
 *   collectionOf(["users", "{}"])                   → "users"
 *   collectionOf(["{}"])                            → undefined (racine inconnue)
 */
export function collectionOf(segs: string[]): string | undefined {
  const s = segs.length % 2 === 0 ? segs.slice(0, -1) : segs;
  if (!s.length || s[0] === "{}") return undefined;
  return s.map((x, i) => (i % 2 === 1 ? "{}" : x)).join("/");
}

/** `"users/{uid}/wallet/{id}"` → `["users", "{}", "wallet", "{}"]`. */
export function splitPath(path: string): string[] {
  return path.split("/").filter(Boolean).map((x) => (/[{}$]/.test(x) ? "{}" : x));
}
