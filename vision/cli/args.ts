/**
 * Arguments de la ligne de commande, débarrassés d'un éventuel séparateur
 * `--` littéral. npm le retire automatiquement avant de le transmettre au
 * script ; pnpm ne le fait pas et le transmet tel quel — ce qui casse le
 * positionnement des arguments si on ne s'en protège pas ici. Voir
 * docs/decisions/0007-cli-args-strip-double-dash.md.
 */
export function cliArgs(): string[] {
  return process.argv.slice(2).filter((a) => a !== "--");
}
