import type { User } from "../user/service";

export interface Invitation {
  id: string;
  invitedBy: User;
  token: string;
  issuedAt: number;
}

const invitations = new Map<string, Invitation>();

export function save(invitation: Invitation): void {
  invitations.set(invitation.id, invitation);
}

export function find(id: string): Invitation | undefined {
  return invitations.get(id);
}
