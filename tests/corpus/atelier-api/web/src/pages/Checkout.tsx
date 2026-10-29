import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useState } from "react";
import { createBooking, type Booking } from "../api/bookings";
import { getWorkshop, type Slot } from "../api/workshops";
import { payBooking } from "../api/payments";
import { usePollBooking } from "../hooks/usePollBooking";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

export function Checkout({ workshopId }: { workshopId: string }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [booking, setBooking] = useState<Booking>();
  const [paying, setPaying] = useState(false);
  const followed = usePollBooking(paying ? booking?.id : undefined);

  useEffect(() => {
    getWorkshop(workshopId).then((w) => setSlots(w.slots));
  }, [workshopId]);

  async function pay() {
    if (!booking) return;
    const { clientSecret } = await payBooking(booking.id);
    const stripe = await stripePromise;
    await stripe?.confirmCardPayment(clientSecret);
    setPaying(true);
  }

  if (followed && followed.status !== "pending") return <p>Réservation {followed.status === "confirmed" ? "confirmée" : followed.status}.</p>;
  if (booking) return <button onClick={pay}>Payer {(booking.priceCents / 100).toFixed(2)} €</button>;
  return (
    <ul>
      {slots.map((s) => (
        <li key={s.id}>
          <button disabled={s.seatsTaken >= s.seats} onClick={() => createBooking(s.id).then(setBooking)}>
            {new Date(s.startsAt).toLocaleString("fr-FR")}
          </button>
        </li>
      ))}
    </ul>
  );
}
