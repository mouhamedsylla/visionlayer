import { randomUUID } from "node:crypto";

export interface User {
  id: string;
  email: string;
}

export function getUser(id: string): User {
  return { id, email: `${id}@example.com` };
}

export function createUser(email: string): User {
  return { id: randomUUID(), email };
}
