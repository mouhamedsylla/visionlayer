import { getFunctions, httpsCallable } from "firebase/functions";

export async function placeOrder(items: string[]) {
  const call = httpsCallable<{ items: string[] }, { id: string }>(
    getFunctions(),
    "placeOrder",
  );
  return (await call({ items })).data;
}
