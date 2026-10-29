import type { ContractFacet, Proof, Shape } from "../arch/types.js";
import type { Database, Value } from "./datalog.js";

/**
 * Le détail d'un contrat, d'après les relations de la syntaxe (syntax-contract.ts) :
 * ce que chaque opération reçoit et rend, champ par champ ; ce que chaque
 * implémentation appelle et où elle rend la main ; quelle valeur de la
 * configuration mène à quelle implémentation ; les paquets du fournisseur et
 * leurs imports hors du module. Rien n'est deviné : chaque fait a sa ligne.
 */
type Detail = Pick<ContractFacet, "summary" | "operations" | "implementations" | "sealed"> & { choices?: NonNullable<ContractFacet["selector"]>["choices"] };

const pkgOf = (raw: string) => raw.split("/").slice(0, raw.startsWith("@") ? 2 : 1).join("/");
const external = (raw: string) => !raw.startsWith(".") && !raw.startsWith("/") && !raw.startsWith("node:");

export function contractDetails(db: Database): (c: { file: string; iface: string; impls: { name: string; path: string; line: number }[]; selector?: { file: string; fn: string } }) => Detail {
  const s = (v: Value | undefined) => String(v);
  const dirOf = (f: string) => (f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : "");

  const fields = new Map<string, { file: string; f: Shape["fields"][number]; proof: Proof }[]>();
  for (const t of db.get("type_field")) {
    const k = s(t.args[1]);
    const comment = s(t.args[5]);
    (fields.get(k) ?? fields.set(k, []).get(k)!).push({
      file: s(t.args[0]),
      f: { name: s(t.args[2]), ...(s(t.args[3]) ? { type: s(t.args[3]) } : {}), ...(s(t.args[4]) === "opt" ? { optional: true } : {}), ...(comment ? { comment } : {}), line: Number(t.args[6]) },
      proof: t.proof[0]!,
    });
  }
  const defLine = new Map(db.get("interface_def").map((t) => [`${s(t.args[0])}\0${s(t.args[1])}`, t.proof[0]!]));
  /** Le type de ce nom, de préférence dans le dossier du contrat. */
  const shape = (name: string, dir: string): Shape | undefined => {
    const all = fields.get(name);
    if (!all?.length) return undefined;
    const file = (all.find((x) => dirOf(x.file) === dir) ?? all[0]!).file;
    const own = all.filter((x) => x.file === file);
    return { name, proof: defLine.get(`${file}\0${name}`) ?? own[0]!.proof, fields: own.map((x) => x.f) };
  };

  const headers = new Map(db.get("file_header").map((t) => [s(t.args[0]), { text: s(t.args[1]), proof: t.proof[0]! }]));
  const imports = db.get("import_raw").map((t) => ({ file: s(t.args[0]), raw: s(t.args[2]), proof: t.proof[0]! })).filter((x) => external(x.raw));

  return ({ file, iface, impls, selector }) => {
    const dir = dirOf(file);
    const index = [...headers.keys()].find((f) => dirOf(f) === dir && /\/index\.[cm]?[jt]sx?$/.test(f));
    const summary = headers.get(index ?? "") ?? headers.get(selector?.file ?? "") ?? headers.get(file);

    const operations = db.get("iface_op").filter((t) => s(t.args[0]) === file && s(t.args[1]) === iface).map((t) => {
      const request = shape(s(t.args[3]), dir);
      const result = shape(s(t.args[4]), dir);
      const comment = s(t.args[5]);
      return { name: s(t.args[2]), line: Number(t.args[6]), ...(comment ? { comment } : {}), ...(request ? { request } : {}), ...(result ? { result } : {}) };
    });
    const ops = new Set(operations.map((o) => o.name));

    const implementations = impls.map((i) => {
      // l'opération, et les méthodes de la classe qu'elle appelle (deux crans)
      const reached = new Set(ops);
      for (let depth = 0; depth < 2; depth++)
        for (const t of db.get("class_self")) if (s(t.args[0]) === i.path && s(t.args[1]) === i.name && reached.has(s(t.args[2]))) reached.add(s(t.args[3]));
      const calls: { name: string; proof: Proof }[] = [];
      for (const t of db.get("class_call")) {
        if (s(t.args[0]) !== i.path || s(t.args[1]) !== i.name || !reached.has(s(t.args[2]))) continue;
        // `this.client.emails.send` se lit `client.emails.send` : le client gardé par la classe
        const name = s(t.args[3]).replace(/^this\./, "");
        if (!calls.some((c) => c.name === name)) calls.push({ name, proof: t.proof[0]! });
      }
      const returns = db.get("class_return").filter((t) => s(t.args[0]) === i.path && s(t.args[1]) === i.name && ops.has(s(t.args[2]))).map((t) => t.proof[0]!);
      const packages = [...new Set(imports.filter((x) => x.file === i.path).map((x) => pkgOf(x.raw)))].sort();
      return { ...i, ...(calls.length ? { calls } : {}), ...(returns.length ? { returns } : {}), ...(packages.length ? { packages } : {}) };
    });

    const sealedPkgs = [...new Set(implementations.flatMap((i) => i.packages ?? []))].sort();
    const leaks = imports.filter((x) => sealedPkgs.includes(pkgOf(x.raw)) && !(dir && x.file.startsWith(`${dir}/`))).map((x) => x.proof);

    const names = new Set(impls.map((i) => i.name));
    const choices = selector
      ? db.get("selects_when").filter((t) => s(t.args[0]) === selector.file && s(t.args[1]) === selector.fn && names.has(s(t.args[2])))
        .map((t) => ({ ...(s(t.args[3]) ? { when: s(t.args[3]) } : {}), implementation: s(t.args[2]), proof: t.proof[0]! }))
      : [];

    return {
      ...(summary ? { summary } : {}),
      operations,
      implementations,
      ...(sealedPkgs.length ? { sealed: { packages: sealedPkgs, leaks } } : {}),
      ...(choices.length ? { choices } : {}),
    };
  };
}
