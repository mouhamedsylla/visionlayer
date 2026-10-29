import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { CloudTasksClient } from "@google-cloud/tasks";
import { db, ordersCol } from "./db";
import { summarize } from "./ai";

const WORKER_URL = process.env.WORKER_URL;

export const placeOrder = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Auth required.");
  const items = request.data.items as string[];
  if (items.length === 0) return { status: "empty" };
  const ref = ordersCol().doc();
  await db().runTransaction(async (tx) => {
    tx.set(ref, { items, uid: request.auth!.uid });
  });
  const note = await summarize(items.join(", "));
  await new CloudTasksClient().createTask({ task: { httpRequest: { url: WORKER_URL } } });
  return { id: ref.id, note };
});

export const unusedAdmin = onCall(async () => ({ ok: true }));

export const onOrderCreated = onDocumentCreated("orders/{orderId}", async (event) => {
  await db().collection("users").doc(String(event.data?.get("uid"))).collection("cart").doc("main").delete();
});

export async function cancelOrder(uid: string, id: string) {
  if (!uid) throw new HttpsError("unauthenticated", "Auth required.");
  const ref = ordersCol().doc(id); // en fin de ligne : n'ouvre pas de passage

  // Annulation : l'ordre est d'abord marqué, puis le client prévenu. Jamais l'inverse.
  // @k shop.cancel-order
  const label = id.trim();
  await ref.update({ status: "cancelled", label });
  if (label) {
    // Résumé pour le client, par le modèle.
    await summarize(label);
  }
  return { status: "cancelled" };
}
