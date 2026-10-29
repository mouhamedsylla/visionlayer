// Le code métier n'envoie jamais un email lui-même : il met un job dans la file emails.
// Seul le worker appelle un EmailSender, et aucun SDK de fournisseur ne sort de ce répertoire.
import { env } from "../env";
import { ConsoleSender } from "./console";
import { ResendSender } from "./resend";
import { SmtpSender } from "./smtp";
import type { EmailSender } from "./types";

let sender: EmailSender | undefined;

/** L'adaptateur du fournisseur : lit EMAIL_PROVIDER, sinon resend. */
export function getSender(): EmailSender {
  if (sender) return sender;
  switch (env.EMAIL_PROVIDER) {
    case "smtp":
      sender = new SmtpSender(env.SMTP_URL ?? "smtp://localhost:1025");
      break;
    case "console":
      sender = new ConsoleSender();
      break;
    default:
      sender = new ResendSender(env.RESEND_API_KEY ?? "");
  }
  return sender;
}

export type { EmailMessage, EmailSender, SendResult } from "./types";
