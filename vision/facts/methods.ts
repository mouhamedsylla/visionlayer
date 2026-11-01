import type { Tuple, Value } from "./datalog.js";

/**
 * Le code d'entreprise appelle surtout des méthodes : un contrôleur passé à une route (`ctrl.find`), un
 * service statique (`EmailService.send()`), une instance (`const search = new SearchService()` puis
 * `search.query()`), un champ injecté (`this.storage.put()`), une méthode de la même classe
 * (`this.validate()`). Ce module relie chacun à la méthode `Classe.méthode` qu'il exécute, d'après la
 * syntaxe seule :
 *
 *   fn_span(F, "Classe.méthode", Début, Fin)   les méthodes des classes de premier niveau
 *   typed(F, Portée, Nom, Type, L)             le type d'un paramètre, d'un champ, d'une valeur `new C()`
 *   defines / resolves                          où une classe est déclarée, depuis le fichier qui la nomme
 *
 * Ce qui n'est pas suivi : un type qui est une interface implémentée par plusieurs classes (le Contrat le
 * montre), une instance fabriquée par une fonction, un appel dont le nom est calculé.
 */

export interface MethodTarget { path: string; name: string; start: number }

export function methodResolver(rows: (rel: string) => readonly Tuple[]) {
  const s = (v: Value | undefined) => String(v);
  const spans = new Map<string, { name: string; start: number; end: number }[]>();
  for (const t of rows("fn_span")) (spans.get(s(t.args[0])) ?? spans.set(s(t.args[0]), []).get(s(t.args[0]))!).push({ name: s(t.args[1]), start: Number(t.args[2]), end: Number(t.args[3]) });
  const resolves = new Map(rows("resolves").map((t) => [`${s(t.args[0])}\0${s(t.args[1])}`, { path: s(t.args[2]), line: Number(t.args[3]) }]));
  const definedAt = new Map(rows("defines").map((t) => [`${s(t.args[0])}\0${s(t.args[2])}`, s(t.args[1])]));
  const typed = new Map<string, string>();
  for (const t of rows("typed")) {
    const k = `${s(t.args[0])}\0${s(t.args[1])}\0${s(t.args[2])}`;
    if (!typed.has(k)) typed.set(k, s(t.args[3]));
  }

  /** La classe que désigne un nom écrit dans ce fichier : déclarée ici, ou importée. */
  const classNamed = (file: string, name: string): { path: string; cls: string } | undefined => {
    const at = resolves.get(`${file}\0${name}`);
    if (!at) return undefined;
    const cls = definedAt.get(`${at.path}\0${at.line}`) ?? name;
    return spans.get(at.path)?.some((sp) => sp.name.startsWith(`${cls}.`)) ? { path: at.path, cls } : undefined;
  };
  /** La classe d'une valeur : son type écrit, ou la classe qu'on a instanciée, ici ou dans le fichier qui l'exporte. */
  const classOfValue = (file: string, scope: string, name: string, depth = 0): { path: string; cls: string } | undefined => {
    const type = typed.get(`${file}\0${scope}\0${name}`);
    if (type) return classNamed(file, type);
    if (scope) return undefined;
    const direct = classNamed(file, name);
    if (direct) return direct;
    const at = resolves.get(`${file}\0${name}`);
    const there = at && definedAt.get(`${at.path}\0${at.line}`);
    return at && there && at.path !== file && depth < 3 ? classOfValue(at.path, "", there, depth + 1) : undefined;
  };
  const method = (c: { path: string; cls: string } | undefined, m: string | undefined): MethodTarget | undefined => {
    if (!c || !m) return undefined;
    const sp = spans.get(c.path)?.find((x) => x.name === `${c.cls}.${m}`);
    return sp ? { path: c.path, name: sp.name, start: sp.start } : undefined;
  };
  const enclosingClass = (file: string, line: number) => {
    const sp = spans.get(file)?.find((x) => x.start <= line && x.end >= line && x.name.includes("."));
    return sp?.name.slice(0, sp.name.indexOf("."));
  };

  /**
   * La méthode qu'exécute un appel ou une référence `racine.chemin`, écrite à cette ligne de ce fichier.
   * `this.m`, `this.champ.m`, `Classe.m`, `valeur.m`.
   */
  return (file: string, line: number, root: string, path: string): MethodTarget | undefined => {
    const [first, second] = path.split(".");
    if (root === "this") {
      const cls = enclosingClass(file, line);
      if (!cls) return undefined;
      if (second) return method(classOfValue(file, cls, first!), second);
      return method({ path: file, cls }, first);
    }
    return method(classOfValue(file, "", root), first);
  };
}
