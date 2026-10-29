import nodemailer from "nodemailer";
import { subject, text } from "./render";
import type { EmailMessage, EmailSender, SendResult } from "./types";

export class SmtpSender implements EmailSender {
  private transport: nodemailer.Transporter;

  constructor(url: string) {
    this.transport = nodemailer.createTransport(url);
  }

  async send(m: EmailMessage): Promise<SendResult> {
    try {
      const info = await this.transport.sendMail({
        from: "bonjour@atelier.example",
        to: m.to,
        subject: subject(m),
        text: text(m),
        replyTo: m.replyTo,
        headers: { "X-Idempotency-Key": m.idempotencyKey },
      });
      return { id: info.messageId, status: "sent", retryable: false, raw: info };
    } catch (err) {
      // 4xx SMTP : refus temporaire, on réessaie ; 5xx : refus définitif.
      const code = (err as { responseCode?: number }).responseCode ?? 0;
      return { id: "", status: "rejected", retryable: code === 0 || (code >= 400 && code < 500), error: String(err), raw: err };
    }
  }
}
