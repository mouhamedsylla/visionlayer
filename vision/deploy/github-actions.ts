import { isMap, isScalar, isSeq, LineCounter, parseDocument, type Node, type YAMLMap } from "yaml";
import { classifyStep } from "./steps.js";
import type { Pipeline, PipelineJob, PipelineStep } from "./types.js";

const lineOf = (lc: LineCounter, n: Node | null | undefined) => (n?.range ? lc.linePos(n.range[0]).line : 1);
const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : undefined);
function get(m: unknown, key: string): Node | undefined {
  if (!isMap(m)) return undefined;
  const pair = m.items.find((p) => isScalar(p.key) && String(p.key.value) === key);
  return (pair?.value ?? undefined) as Node | undefined;
}
const scalar = (n: Node | undefined) => (isScalar(n) ? str(n.value) : undefined);
const list = (n: Node | undefined): string[] => (isSeq(n) ? n.items.flatMap((i) => (isScalar(i) ? [String(i.value)] : [])) : scalar(n) ? [scalar(n)!] : []);

function triggers(doc: YAMLMap, lc: LineCounter): Pipeline["triggers"] {
  const pair = doc.items.find((p) => isScalar(p.key) && (p.key.value === "on" || p.key.value === true));
  const on = pair?.value as Node | undefined;
  if (!on) return [];
  if (isScalar(on) || isSeq(on)) return list(on).map((label) => ({ label, line: lineOf(lc, on) }));
  if (!isMap(on)) return [];
  return on.items.flatMap((p) => {
    if (!isScalar(p.key)) return [];
    const branches = list(get(p.value, "branches"));
    return [{ label: branches.length ? `${p.key.value} (${branches.join(", ")})` : String(p.key.value), line: lineOf(lc, p.key as Node) }];
  });
}

function step(n: Node, lc: LineCounter): PipelineStep {
  const run = scalar(get(n, "run"));
  const uses = scalar(get(n, "uses"));
  const command = (run ?? uses ?? "").split("\n").find((l) => l.trim())?.trim() ?? "";
  const whole = [run, uses].filter(Boolean).join(" ");
  const secrets = [...new Set([...String(n).matchAll(/secrets\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]!))];
  return {
    line: lineOf(lc, n), label: scalar(get(n, "name")) ?? command, command, ...classifyStep(whole),
    ...(secrets.length ? { secrets } : {}),
  };
}

/** Un workflow GitHub Actions : ses déclencheurs, ses jobs dans l'ordre de leurs `needs`, leurs étapes. */
export function readGithubWorkflow(path: string, content: string): Pipeline {
  const lc = new LineCounter();
  const doc = parseDocument(content, { lineCounter: lc });
  const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.ya?ml$/, "");
  if (doc.errors.length || !isMap(doc.contents)) return { path, name, triggers: [], jobs: [], parseError: doc.errors[0]?.message ?? "workflow vide" };
  const root = doc.contents;
  const jobsNode = get(root, "jobs");
  const jobs: PipelineJob[] = isMap(jobsNode) ? jobsNode.items.flatMap((p) => {
    if (!isScalar(p.key)) return [];
    const j = p.value as Node;
    const env = get(j, "environment");
    const envName = scalar(env) ?? scalar(get(env, "name"));
    const steps = get(j, "steps");
    const when = scalar(get(j, "if"));
    return [{
      id: String(p.key.value), line: lineOf(lc, p.key as Node), needs: list(get(j, "needs")),
      ...(envName ? { environment: { name: envName, line: lineOf(lc, env) } } : {}),
      ...(when ? { when } : {}),
      steps: isSeq(steps) ? steps.items.map((s) => step(s as Node, lc)) : [],
    }];
  }) : [];
  return { path, name: scalar(get(root, "name")) ?? name, triggers: triggers(root, lc), jobs };
}
