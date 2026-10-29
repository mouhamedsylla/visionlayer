import { randomUUID } from "node:crypto";
import { subject } from "./render";
import type { EmailMessage, EmailSender, SendResult } from "./types";

/** Pour le développement : affiche le sujet et le gabarit, jamais l'adresse. */
export class ConsoleSender implements EmailSender {
  async send(m: EmailMessage): Promise<SendResult> {
    console.log(`[email] ${m.template} · ${subject(m)}`);
    return { id: randomUUID(), status: "sent", retryable: false, raw: null };
  }
}
