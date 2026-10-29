import { doc, getDoc, getFirestore } from "firebase/firestore";

const db = getFirestore();

export async function loadCart(uid: string) {
  return getDoc(doc(db, "users", uid, "cart", "main"));
}
