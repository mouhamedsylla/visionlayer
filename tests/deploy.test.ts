import { test } from "node:test";
import assert from "node:assert/strict";
import { readGithubWorkflow } from "../vision/deploy/github-actions.js";
import { classifyStep } from "../vision/deploy/steps.js";

const WORKFLOW = [
  "name: deploy",
  "on:",
  "  push:",
  "    branches: [main]",
  "  workflow_dispatch:",
  "jobs:",
  "  test:",
  "    runs-on: ubuntu-latest",
  "    steps:",
  "      - uses: actions/checkout@v4",
  "      - run: pnpm install --frozen-lockfile",
  "      - name: Tests",
  "        run: pnpm test",
  "  ship:",
  "    needs: test",
  "    if: github.ref == 'refs/heads/main'",
  "    environment: production",
  "    steps:",
  "      - uses: superfly/flyctl-actions/setup-flyctl@master",
  "      - run: flyctl deploy --remote-only",
  "        env:",
  "          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}",
].join("\n");

test("deploy : un workflow, ses déclencheurs, ses jobs dans l'ordre, l'environnement et le secret par son nom", () => {
  const p = readGithubWorkflow(".github/workflows/deploy.yml", WORKFLOW);
  assert.deepEqual(p.triggers, [{ label: "push (main)", line: 3 }, { label: "workflow_dispatch", line: 5 }]);
  assert.deepEqual(p.jobs.map((j) => `${j.id}:${j.line} needs=${j.needs.join(",")}`), ["test:7 needs=", "ship:14 needs=test"]);
  const ship = p.jobs[1]!;
  assert.deepEqual(ship.environment, { name: "production", line: 17 });
  assert.equal(ship.when, "github.ref == 'refs/heads/main'");
  assert.deepEqual(ship.steps.map((s) => `${s.line} ${s.kind} ${s.target ?? ""}`.trim()), ["19 deploy flyio", "20 deploy flyio"]);
  assert.deepEqual(ship.steps[1]!.secrets, ["FLY_API_TOKEN"]);
  assert.deepEqual(p.jobs[0]!.steps.map((s) => `${s.label} ${s.kind}`), ["actions/checkout@v4 checkout", "pnpm install --frozen-lockfile install", "Tests check"]);
});

test("deploy : une étape est rangée par sa commande, jamais par le projet", () => {
  assert.deepEqual(classifyStep("docker build -t api ."), { kind: "image", target: "docker" });
  assert.deepEqual(classifyStep("npx vercel deploy --prod"), { kind: "deploy", target: "vercel" });
  assert.deepEqual(classifyStep("firebase deploy --only hosting"), { kind: "deploy", target: "firebase" });
  assert.deepEqual(classifyStep("pnpm typecheck"), { kind: "check" });
  assert.deepEqual(classifyStep("pnpm run build"), { kind: "build" });
  assert.deepEqual(classifyStep("echo bonjour"), { kind: "other" });
});

test("deploy : un workflow illisible le dit au lieu de deviner", () => {
  assert.ok(readGithubWorkflow("x.yml", "jobs: [\n").parseError);
});
