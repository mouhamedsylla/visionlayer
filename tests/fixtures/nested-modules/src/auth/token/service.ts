import { getUser } from "../user/service";

export function issue(): string {
  return getUser() + "-token";
}
