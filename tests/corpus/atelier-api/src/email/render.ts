import type { EmailMessage } from "./types";

const SUBJECTS: Record<EmailMessage["template"], { fr: string; en: string }> = {
  "booking-received": { fr: "Réservation reçue", en: "Booking received" },
  "payment-accepted": { fr: "Paiement accepté", en: "Payment accepted" },
  "payment-failed": { fr: "Le paiement n'a pas abouti", en: "Payment failed" },
  reminder: { fr: "Votre atelier, c'est demain", en: "Your workshop is tomorrow" },
  "refund-done": { fr: "Remboursement effectué", en: "Refund completed" },
  "password-reset": { fr: "Nouveau mot de passe", en: "Reset your password" },
};

export function subject(m: EmailMessage): string {
  return SUBJECTS[m.template][m.locale];
}

export function text(m: EmailMessage): string {
  return Object.entries(m.data)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}
