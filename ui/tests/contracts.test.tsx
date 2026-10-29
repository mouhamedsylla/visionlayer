import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contractLife } from "../src/domain/contracts/life";
import { choicesLabel, contractsOf, findContract, selectorEnv, usersOf } from "../src/domain/contracts/list";
import { ContractsScreen } from "../src/screens/contracts/ContractsScreen";
import { atelierMap } from "./atelier";

describe("Contrats, sur atelier-api", async () => {
  const map = await atelierMap();
  const { model } = map;
  const names = new Map(model.nodes.map((n) => [n.id, n.name]));
  const project = { name: "atelier-api" };
  afterEach(() => vi.unstubAllGlobals());

  it("trouve le contrat d'envoi d'emails, qui le choisit et ce qu'il lit, noms seulement", () => {
    expect(contractsOf(model).map((c) => c.contract.name)).toEqual(["EmailSender"]);
    const ref = findContract(model, undefined)!;
    expect(choicesLabel(ref.contract)).toBe("smtp → SmtpSender · console → ConsoleSender · sinon ResendSender");
    expect(selectorEnv(ref, model).map((v) => v.name)).toEqual(["EMAIL_PROVIDER", "RESEND_API_KEY", "SMTP_URL"]);
    expect(findContract(model, "inconnu")).toBeUndefined();
  });

  it("dit qui finit par l'employer : le worker qui l'appelle, puis chaque point d'entrée qui met un job dans sa file", () => {
    const users = usersOf(findContract(model, "email")!, model);
    expect(users[0]!.item.entry.handler?.name).toBe("sendEmail");
    expect(users[0]!.how).toBe("appelle getSender()");
    expect(users.slice(1).every((u) => u.how === "met un job dans « emails »")).toBe(true);
    expect(users.map((u) => u.item.entry.handler?.name)).toContain("stripeWebhook");
  });

  it("suit la vie d'un appel en couloirs, de la file au fournisseur et retour, puis la suite du worker", () => {
    const life = contractLife(findContract(model, "email")!, model, names);
    expect(life.lanes.map((l) => l.title).slice(1, 5)).toEqual(["Message", "sendEmail", "Adaptateur", "Fournisseur"]);
    expect(life.steps.map((s) => s.view.title).slice(0, 5)).toEqual([
      "Met un job dans « emails »", "sendEmail prend le job", "Obtient l'adaptateur : getSender()",
      "ResendSender traduit en appel natif · client.emails.send", "La réponse redevient un SendResult",
    ]);
    // la ligne de mise en file que son auteur a commentée
    expect(life.steps[0]!.step.why?.text).toMatch(/jobId = gabarit \+ réservation/);
    expect(life.steps.at(-2)!.step.why?.text).toMatch(/^429 et 5xx/);
  });

  it("montre ce que promet le contrat, champ par champ, avec le commentaire de l'auteur", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
    render(<ContractsScreen project={project} map={map} params={[]} />);
    expect(screen.getByRole("heading", { level: 1, name: "EmailSender" })).toBeTruthy();
    expect(screen.getByText("1 · Ce que le contrat promet : une opération, send")).toBeTruthy();
    const row = screen.getByText("Même clé = même email : un job rejoué n'envoie pas deux fois.").closest("tr")!;
    expect(within(row).getByText("string")).toBeTruthy();
    expect(screen.getByText(/vérifié : aucun fichier hors de src\/email n'importe nodemailer ni resend/)).toBeTruthy();
  });

  it("range les fournisseurs : ce que chacun appelle et quand il est choisi", () => {
    render(<ContractsScreen project={project} map={map} params={["email", "fournisseurs"]} />);
    expect(screen.getAllByText("client.emails.send").length).toBeGreaterThan(0);
    expect(screen.getByText("choisie quand aucun autre cas ne répond")).toBeTruthy();
  });
});
