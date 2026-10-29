import { api } from "./client";

export interface Booking {
  id: string;
  status: "pending" | "confirmed" | "cancelled" | "refunded";
  holdUntil: string;
  priceCents: number;
}

export const createBooking = (slotId: string, notes?: string) =>
  api<Booking>("/bookings", { method: "POST", body: JSON.stringify({ slotId, notes }) });

export const getBooking = (id: string) => api<Booking>(`/bookings/${id}`);

export const cancelBooking = (id: string) =>
  api<{ id: string; status: string }>(`/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
