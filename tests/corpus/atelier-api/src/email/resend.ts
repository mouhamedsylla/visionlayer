import { Resend } from "resend";
import { subject, text } from "./render";
import type { EmailMessage, EmailSender, SendResult } from "./types";

const FROM = "atelier <bonjour@atelier.example>";

export class ResendSender implements EmailSender {
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(m: EmailMessage): Promise<SendResult> {
    const { data, error } = await this.client.emails.send(
      {
        from: FROM,
        to: m.to,
        subject: subject(m),
        text: text(m),
        replyTo: m.replyTo,
        tags: m.tags.map((name) => ({ name, value: "1" })),
      },
      { idempotencyKey: m.idempotencyKey },
    );
    if (error) {
      const retryable = error.name === "rate_limit_exceeded" || error.name === "internal_server_error";
      return { id: "", status: "rejected", retryable, error: error.message, raw: error };
    }
    return { id: data?.id ?? "", status: "sent", retryable: false, raw: data };
  }
}
