import { api } from "./client";

export interface Workshop {
  id: string;
  title: string;
  instructor: string;
}

export interface Slot {
  id: string;
  startsAt: string;
  seats: number;
  seatsTaken: number;
  priceCents: number;
}

export const listWorkshops = () => api<Workshop[]>("/workshops");
export const getWorkshop = (id: string) => api<Workshop & { description: string; slots: Slot[] }>(`/workshops/${id}`);
