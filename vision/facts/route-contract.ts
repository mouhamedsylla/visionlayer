import type { Entrypoint, Proof, RouteContract } from "../arch/types.js";

type Row = { readonly args: readonly unknown[]; readonly proof: readonly Proof[] };
const s = (v: unknown) => String(v);

/**
 * Le contrat de chaque route, d'après des relations neutres que les packs remplissent : `route_chain`, `route_input`,
 * `schema_field`, `schema_parse`, `fn_status`, `resolves`. Ce module ne connaît aucun framework.
 */
export function routeContracts(rows: (rel: string) => readonly Row[], entries: Entrypoint[]): void {
  const resolves = new Map(rows("resolves").map((t) => [`${s(t.args[0])}\0${s(t.args[1])}`, { path: s(t.args[2]), line: Number(t.args[3]) }]));
  // Un intermédiaire d'un paquet (helmet, cors) reste hors de la chaîne : on montre ce que le projet écrit.
  const repoOrLocal = (f: string, n: string) => resolves.has(`${f}\0${n}`) || !rows("import_raw").some((t) => s(t.args[0]) === f && s(t.args[1]) === n && !/^(\.|@\/|~\/)/.test(s(t.args[2])));
  const made = new Map(rows("ex_call_bind").map((t) => [`${s(t.args[0])}\0${s(t.args[1])}`, s(t.args[2])]));
  const statusOf = new Map<string, { code: string; proof: Proof }[]>();
  for (const t of rows("fn_status")) {
    const k = `${s(t.args[0])}:${s(t.args[1])}`;
    const code = s(t.args[2]);
    const list = statusOf.get(k) ?? statusOf.set(k, []).get(k)!;
    if (!list.some((x) => x.code === code)) list.push({ code, proof: { path: s(t.args[0]), line: Number(t.args[3]), source: "syntax" } });
  }
  // Une erreur fabriquée par une fonction du même fichier : `throw unauthenticated()`.
  for (const t of rows("calls_in")) {
    const [f, at, callee] = [s(t.args[0]), s(t.args[1]), s(t.args[2])];
    const to = resolves.get(`${f}\0${callee}`);
    const theirs = to && statusOf.get(`${to.path}:${to.line}`);
    if (!theirs) continue;
    const list = statusOf.get(`${f}:${at}`) ?? statusOf.set(`${f}:${at}`, []).get(`${f}:${at}`)!;
    for (const x of theirs) if (!list.some((y) => y.code === x.code)) list.push(x);
  }
  const fieldsOf = (path: string, schema: string, partial: boolean) => rows("schema_field").filter((t) => s(t.args[0]) === path && s(t.args[1]) === schema)
    .map((t) => ({ name: s(t.args[2]), type: s(t.args[3]), required: !partial && s(t.args[4]) === "yes", proof: { path, line: Number(t.args[5]), source: "syntax" as const } }));
  const spans = new Map<string, { start: number; end: number }[]>();
  for (const t of rows("fn_span")) (spans.get(s(t.args[0])) ?? spans.set(s(t.args[0]), []).get(s(t.args[0]))!).push({ start: Number(t.args[2]), end: Number(t.args[3]) });

  for (const e of entries) {
    if (e.kind !== "http" && e.kind !== "rpc") continue;
    const here = (t: Row) => s(t.args[0]) === e.proof.path && Number(t.args[1]) === e.proof.line;
    const chain: RouteContract["chain"] = rows("route_chain").filter(here)
      .map((t) => ({ level: Number(t.args[2]), file: s(t.args[3]), name: s(t.args[4]), line: Number(t.args[5]) }))
      .filter((x) => repoOrLocal(x.file, x.name))
      .sort((a, b) => a.level - b.level || a.line - b.line)
      .filter((x, i, all) => all.findIndex((y) => y.name === x.name && y.file === x.file) === i)
      .map((x) => {
        const callee = made.get(`${x.file}\0${x.name}`);
        const def = resolves.get(`${x.file}\0${x.name}`) ?? (callee ? resolves.get(`${x.file}\0${callee}`) : undefined);
        return {
          name: x.name, proof: { path: x.file, line: x.line, source: "syntax" as const },
          ...(def ? { def: { path: def.path, line: def.line, source: "syntax" as const } } : {}),
          statuses: def ? statusOf.get(`${def.path}:${def.line}`) ?? [] : [],
        };
      });
    // Le schéma : donné à un intermédiaire de la route, ou appliqué dans sa fonction.
    let input: RouteContract["input"];
    const given = rows("route_input").find(here);
    if (given) {
      const [path, schema] = [s(given.args[2]), s(given.args[3])];
      input = { schema, part: "body", proof: { path: e.proof.path, line: e.proof.line, source: "syntax" }, fields: fieldsOf(path, schema, s(given.args[4]) === "partial") };
    } else if (e.handler) {
      const span = spans.get(e.handler.path)?.find((x) => x.start === e.handler!.line);
      const inSpan = span ? rows("schema_parse").filter((t) => s(t.args[0]) === e.handler!.path && Number(t.args[2]) >= span.start && Number(t.args[2]) <= span.end) : [];
      const rank = (t: Row) => ["body", "query", "params"].indexOf(s(t.args[3]));
      const parsed = [...inSpan].sort((a, b) => rank(a) - rank(b))[0];
      const ref = parsed && rows("schema_ref").find((t) => s(t.args[0]) === e.handler!.path && s(t.args[1]) === s(parsed.args[1]));
      if (parsed && ref) input = { schema: s(ref.args[3]), part: s(parsed.args[3]), proof: { path: e.handler.path, line: Number(parsed.args[2]), source: "syntax" }, fields: fieldsOf(s(ref.args[2]), s(ref.args[3]), false) };
    }
    if (chain.length || input) e.contract = { chain, ...(input ? { input } : {}) };
  }
}
