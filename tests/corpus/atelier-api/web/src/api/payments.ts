import { api } from "./client";

export interface PaymentStart {
  clientSecret: string;
}

/**
 * Démarre le paiement d'une réservation. Un second clic renvoie le même
 * paiement : l'API utilise la réservation comme clé chez Stripe.
 */
export function payBooking(bookingId: string) {
  return api<PaymentStart>("/payments", { method: "POST", body: JSON.stringify({ bookingId }) });
}
