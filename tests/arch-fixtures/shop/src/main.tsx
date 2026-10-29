import { lazy } from "react";
import { loadCart } from "@/src/services/cart";

const Checkout = lazy(() => import("@/src/pages/Checkout"));

export function App() {
  void loadCart("u1");
  return <Checkout />;
}
