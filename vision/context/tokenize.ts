const STOPWORDS = new Set([
  // anglais
  "the", "a", "an", "of", "to", "for", "in", "on", "and", "or", "is", "are", "with", "by", "it", "this", "that",
  // français
  "le", "la", "les", "de", "du", "des", "un", "une", "et", "à", "pour", "dans", "sur", "au", "aux", "avec", "par", "ce", "cette",
]);

/**
 * Découpe un texte libre OU un identifiant de code (camelCase, snake_case,
 * kebab-case, chemin de fichier) en mots-clés comparables. Utilisé à la fois
 * pour la tâche donnée par l'utilisateur et pour les noms de symboles/chemins
 * du modèle, afin que "invitation" (dans la tâche) matche "InvitationService"
 * (dans le code).
 */
export function tokenize(text: string): string[] {
  const withSpacedBoundaries = text.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return withSpacedBoundaries
    .toLowerCase()
    .split(/[^a-zà-ÿ0-9]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

export function hasOverlap(tokens: string[], target: Set<string>): boolean {
  return tokens.some((t) => target.has(t));
}
