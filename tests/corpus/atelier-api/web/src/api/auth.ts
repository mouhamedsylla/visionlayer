import { api } from "./client";

export const signup = (input: { email: string; name: string; phone?: string; password: string }) =>
  api<{ id: string }>("/auth/signup", { method: "POST", body: JSON.stringify(input) });

export const login = (email: string, password: string) =>
  api<{ id: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
