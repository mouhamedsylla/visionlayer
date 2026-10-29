/** `1 table`, `14 tables` ; le pluriel est donné quand il n'est pas régulier. */
export function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n > 1 ? plural : singular}`;
}

/** `a, b et c`. */
export function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} et ${words[words.length - 1]}`;
}
