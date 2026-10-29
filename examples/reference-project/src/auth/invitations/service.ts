import { randomUUID } from "node:crypto";
import { generate } from "../token/service";
import { send } from "../../notifications/email";
import { save } from "./repository";
import type { Invitation } from "./repository";
import type { User } from "../user/service";

export function createInvitation(invitedBy: User, email: string): Invitation {
  const invitation: Invitation = {
    id: randomUUID(),
    invitedBy,
    token: generate(),
    issuedAt: Date.now(),
  };
  save(invitation);
  send({ to: email, subject: "You're invited", body: `Token: ${invitation.token}` });
  return invitation;
}
