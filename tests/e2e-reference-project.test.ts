import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { buildModel } from "../vision/model/build.js";
import { readModel, writeModel } from "../vision/model/store.js";
import { archiveCurrentAsPrevious, readPreviousModel } from "../vision/model/history.js";
import { diffModels } from "../vision/diff/diff.js";
import { formatDiff } from "../vision/diff/format.js";
import { buildChangeReport } from "../vision/report/build.js";
import { formatChangeReport } from "../vision/report/format.js";
import { loadRiskPolicy } from "../vision/policy/riskClassifier.js";
import { buildAgentContext } from "../vision/context/build.js";
import { buildInspectResult } from "../vision/inspect/build.js";
import { resolveSymbol } from "../vision/model/query.js";

const WORKFLOW_ROOT = join(import.meta.dirname, "..");
const REFERENCE_PROJECT = join(WORKFLOW_ROOT, "examples", "reference-project");
const POLICY_PATH = join(WORKFLOW_ROOT, "policies", "high-risk-paths.yaml");

function tempCopyOfReferenceProject(): string {
  const root = mkdtempSync(join(tmpdir(), "vision-e2e-"));
  cpSync(REFERENCE_PROJECT, root, { recursive: true });
  return root;
}

/**
 * Test global : rejoue le scénario "implémenter l'expiration d'une
 * invitation" (vision-layer-concept.md §32) sur une copie temporaire du
 * projet de référence, en enchaînant MVP0 à MVP4 exactement comme un
 * ingénieur (ou un agent) le ferait — pas des modules testés isolément.
 */
test("test global : implémenter l'expiration d'une invitation, de bout en bout (MVP0-4)", () => {
  const root = tempCopyOfReferenceProject();
  try {
    // MVP0 — premier scan, état "avant"
    let model = buildModel(root);
    writeModel(root, model);
    assert.equal(model.files.length, 7);

    // MVP1 — navigation avant de coder : où est createInvitation, où mène generateToken ?
    const inspectResult = buildInspectResult(model, root, "createInvitation");
    assert.equal(inspectResult.kind, "symbol");

    const tokenSource = resolveSymbol(model, "generateToken");
    assert.equal(tokenSource.kind, "found");
    if (tokenSource.kind === "found") {
      assert.equal(tokenSource.result.file.path, "src/auth/token/service.ts");
      assert.equal(tokenSource.result.via.length, 1); // suit le ré-export depuis auth/index.ts
    }

    // MVP2 — contexte agent pour la tâche, avant d'écrire le code
    const context = buildAgentContext(model, "Implémenter l'expiration d'une invitation");
    assert.ok(
      context.matchedFiles.some((f) => f.path.includes("invitations")),
      "le contexte doit faire ressortir le domaine invitations pour cette tâche",
    );

    // Le changement lui-même : ajout d'un fichier + branchement dans service.ts
    archiveCurrentAsPrevious(root);

    writeFileSync(
      join(root, "src/auth/invitations/expiration.ts"),
      [
        'import type { Invitation } from "./repository";',
        "",
        "const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;",
        "",
        "export function isInvitationExpired(invitation: Invitation): boolean {",
        "  return Date.now() - invitation.issuedAt > INVITATION_TTL_MS;",
        "}",
        "",
      ].join("\n"),
    );

    const servicePath = join(root, "src/auth/invitations/service.ts");
    const serviceSource = readFileSync(servicePath, "utf-8");
    writeFileSync(
      servicePath,
      serviceSource.replace(
        'import type { Invitation } from "./repository";',
        'import type { Invitation } from "./repository";\nimport { isInvitationExpired } from "./expiration";',
      ),
    );

    // MVP0/3 — deuxième scan, état "après"
    model = buildModel(root);
    writeModel(root, model);

    // MVP3 — Architecture Diff
    const before = readPreviousModel(root)!;
    const after = readModel(root);
    const diff = diffModels(before, after);

    assert.deepStrictEqual(diff.addedFiles, ["src/auth/invitations/expiration.ts"]);
    assert.ok(diff.addedSymbols.some((s) => s.name === "isInvitationExpired"));
    assert.ok(
      diff.addedDependencies.some(
        (d) => d.from === "src/auth/invitations/service.ts" && d.to === "src/auth/invitations/expiration.ts",
      ),
      "service.ts doit apparaître comme dépendant du nouveau fichier expiration.ts",
    );
    assert.match(formatDiff(diff), /\+ src\/auth\/invitations\/expiration\.ts/);

    // MVP4 — Change Report, lié à la vraie politique de gouvernance
    const policy = loadRiskPolicy(POLICY_PATH);
    const report = buildChangeReport({
      task: "Implémenter l'expiration d'une invitation",
      intent: "Ajouter l'expiration au cycle de vie de l'invitation",
      before,
      after,
      policy,
    });

    // src/auth/** est un chemin HIGH : même un ajout en apparence anodin
    // dans ce dossier déclenche l'approbation humaine explicite.
    assert.equal(report.riskLevel, "high");
    assert.equal(report.requiresHumanApproval, true);
    assert.match(formatChangeReport(report), /Approbation humaine requise/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Même projet de référence (avant mutation, plus simple), mais interrogé à
 * travers le vrai serveur MCP (MVP5) plutôt que les fonctions internes
 * directement — pour confirmer que les 6 MVP fonctionnent ensemble sur un
 * projet réaliste, pas seulement chacun isolément sur des fixtures minimales.
 */
test("test global : le serveur MCP répond correctement sur le projet de référence", async () => {
  const root = tempCopyOfReferenceProject();
  const transport = new StdioClientTransport({
    command: join(WORKFLOW_ROOT, "node_modules", ".bin", "tsx"),
    args: [join(WORKFLOW_ROOT, "integrations", "agents", "server.ts")],
  });
  const client = new Client({ name: "e2e-test-client", version: "0.0.0" });

  try {
    writeModel(root, buildModel(root));
    await client.connect(transport);

    const contextResult = await client.callTool({
      name: "vision_context",
      arguments: { task: "envoyer un email d'invitation", root },
    });
    const context = JSON.parse((contextResult.content as { text: string }[])[0]!.text);
    assert.ok(context.matchedFiles.some((f: { path: string }) => f.path.includes("notifications")));

    const sourceResult = await client.callTool({
      name: "vision_source",
      arguments: { name: "createUser", root },
    });
    const source = JSON.parse((sourceResult.content as { text: string }[])[0]!.text);
    assert.equal(source.kind, "found");
    assert.equal(source.result.file.path, "src/auth/user/service.ts");
  } finally {
    await client.close();
    rmSync(root, { recursive: true, force: true });
  }
});
