import { placeOrder } from "@/src/services/orders";

export default function Checkout() {
  return <button onClick={() => placeOrder(["a"])}>Commander</button>;
}
