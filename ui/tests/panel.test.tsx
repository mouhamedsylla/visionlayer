import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Breakable } from "../src/components/Breakable";
import { PanelSwitch } from "../src/components/panel/PanelSwitch";
import { PanelVars } from "../src/components/panel/PanelVars";
import { ProofRef } from "../src/components/ProofRef";
import { PanelItem, PanelSection, SidePanel } from "../src/components/SidePanel";
import { codeTokens } from "../src/domain/text/codeTokens";
import { splitCount } from "../src/domain/text/count";
import { methodCounts } from "../src/domain/features/methods";
import type { EntryRef } from "../src/domain/features/list";

describe("le panneau de droite, pour un gros système", () => {
  it("sépare le compte final d'un titre, sauf quand le titre en porte deux", () => {
    expect(splitCount("Parle à · 3")).toEqual({ label: "Parle à", count: "3" });
    expect(splitCount("Lue par · 3 · écrite par · 2")).toEqual({ label: "Lue par · 3 · écrite par · 2" });
    expect(splitCount("Comment c'est trouvé")).toEqual({ label: "Comment c'est trouvé" });
  });

  it("montre cinq lignes d'une longue section, les autres sur demande, et se replie", () => {
    render(<PanelSection title="Variables lues · 12">{Array.from({ length: 12 }, (_, i) => <PanelItem key={i} title={`VAR_${i}`} />)}</PanelSection>);
    expect(screen.queryByText("VAR_5")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Voir les 7 autres" }));
    expect(screen.getByText("VAR_11")).toBeTruthy();
    const toggle = screen.getByRole("button", { name: /Variables lues/ });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("ne coupe un nom de code qu'à ses jointures", () => {
    const { container } = render(<span><Breakable text="stripeWebhook processed_events" /></span>);
    expect(container.innerHTML).toBe("<span>stripe<wbr>Webhook processed_<wbr>events</span>");
  });

  it("se replie en rail et se rouvre", () => {
    render(<SidePanel label="Autour du contrat"><p>contenu</p></SidePanel>);
    const fold = screen.getByRole("button", { name: "Replier le panneau" });
    fireEvent.click(fold);
    expect(screen.getByRole("button", { name: "Ouvrir le panneau : Autour du contrat" }).getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le panneau : Autour du contrat" }));
    expect(screen.getByRole("button", { name: "Replier le panneau" })).toBeTruthy();
  });

  it("ouvre le passage de code d'un repère, et le referme avec Échap", () => {
    render(<ProofRef proof={{ path: "src/email/index.ts", line: 16 }} />);
    fireEvent.click(screen.getByRole("button", { name: "index.ts:16" }));
    expect(screen.getByRole("dialog", { name: "Code de src/email/index.ts, ligne 16" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("teinte le code : commentaires, chaînes et mots-clés, un bloc de commentaire sur plusieurs lignes", () => {
    const [a, b, c] = codeTokens(['const url = "http://x"; // relance', "/* début", "fin */ return url;"]);
    expect(a!.filter((t) => t.tone !== "plain").map((t) => [t.tone, t.text])).toEqual([["keyword", "const"], ["string", '"http://x"'], ["comment", "// relance"]]);
    expect(b).toEqual([{ text: "/* début", tone: "comment" }]);
    expect(c!.map((t) => t.tone)).toEqual(["comment", "plain", "keyword", "plain", "plain", "plain"]);
  });

  it("dessine un aiguillage : chaque condition, où elle mène, la voie par défaut", () => {
    const at = { path: "src/pick.go", line: 4 };
    render(<PanelSwitch head="pick()" proof={at} ways={[{ when: 'mode == "s3"', target: "S3Store", proof: at }, { target: "DiskStore" }]} />);
    expect(screen.getByText("S3Store")).toBeTruthy();
    expect(screen.getByText("sinon")).toBeTruthy();
    expect(screen.getByText("par défaut")).toBeTruthy();
  });

  it("dit d'une variable si elle est requise, sans jamais sa valeur", () => {
    render(<PanelVars vars={[{ name: "S3_BUCKET", required: true, at: [] }, { name: "LOG_LEVEL", at: [] }]} />);
    expect(screen.getByText("requise")).toBeTruthy();
    expect(screen.getByText("le code ne dit pas")).toBeTruthy();
  });

  it("compte les méthodes d'un regroupement, dans l'ordre habituel", () => {
    const e = (key: string) => ({ entry: { id: key, kind: "http", key, proof: { path: "a", line: 1 } } }) as unknown as EntryRef;
    expect(methodCounts([e("POST /a"), e("GET /a"), e("POST /a/:id"), e("DELETE /a/:id")])).toEqual([
      { method: "GET", n: 1 }, { method: "POST", n: 2 }, { method: "DELETE", n: 1 },
    ]);
  });
});
