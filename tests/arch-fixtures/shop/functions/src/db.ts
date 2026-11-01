import { getFirestore } from "firebase-admin/firestore";

export const db = () => getFirestore();

/** Chemin renvoyé par une fonction utilitaire, comme txCol(uid). */
export function ordersCol() {
  return db().collection("orders");
}
