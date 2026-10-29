import { generateToken } from "./auth/index";

export function run(): string {
  return generateToken();
}
