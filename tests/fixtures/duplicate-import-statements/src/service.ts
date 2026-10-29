import { save } from "./repository";
import type { Thing } from "./repository";

export function create(thing: Thing): void {
  save(thing);
}
