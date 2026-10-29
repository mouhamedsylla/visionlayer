// Le contrat d'envoi d'emails : le code métier ne voit que ces types.

export const TEMPLATES = ["booking-received", "payment-accepted", "payment-failed", "reminder", "refund-done", "password-reset"] as const;
export type Template = (typeof TEMPLATES)[number];

/** Ce qu'un job de la file emails transporte : des identifiants, jamais d'adresse. */
export interface EmailJob {
  template: Template;
  bookingId?: string;
  userId?: string;
  token?: string;
}

export interface EmailMessage {
  /** Adresse du client : donnée personnelle, jamais écrite dans les logs. */
  to: string;
  /** Gabarit LOGIQUE : chaque adaptateur le rend à sa façon. */
  template: Template;
  locale: "fr" | "en";
  /** Variables du gabarit, validées par Zod avant l'envoi. */
  data: Record<string, string>;
  /** Même clé = même email : un job rejoué n'envoie pas deux fois. */
  idempotencyKey: string;
  replyTo?: string;
  /** Pour retrouver l'email chez le fournisseur. */
  tags: string[];
}

export interface SendResult {
  /** Identifiant de l'email chez le fournisseur. */
  id: string;
  status: "sent" | "queued" | "rejected";
  /** Vrai si l'échec vaut une nouvelle tentative (429, 5xx). */
  retryable: boolean;
  error?: string;
  /** Réponse native brute (jamais dans le code partagé). */
  raw: unknown;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<SendResult>;
}
