import { useEffect, useState } from "react";
import { getBooking, type Booking } from "../api/bookings";

/** Suit la réservation pendant le paiement : toutes les 3 s, jusqu'à un état final. */
export function usePollBooking(id: string | undefined) {
  const [booking, setBooking] = useState<Booking>();
  useEffect(() => {
    if (!id) return;
    let stop = false;
    const tick = async () => {
      const b = await getBooking(id);
      if (stop) return;
      setBooking(b);
      if (b.status === "pending") setTimeout(tick, 3000);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [id]);
  return booking;
}
