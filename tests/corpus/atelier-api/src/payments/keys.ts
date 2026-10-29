/** La clé d'idempotence Stripe d'un paiement : la réservation, pas la requête. */
export const paymentKey = (bookingId: string) => `booking-${bookingId}`;
