import { useState } from "react";
import { Checkout } from "./pages/Checkout";
import { Signup } from "./pages/Signup";
import { Workshops } from "./pages/Workshops";

export function App() {
  const [view, setView] = useState<{ name: "list" } | { name: "signup" } | { name: "checkout"; id: string }>({ name: "list" });
  return (
    <main>
      <header>
        <button onClick={() => setView({ name: "list" })}>Ateliers</button>
        <button onClick={() => setView({ name: "signup" })}>Créer un compte</button>
      </header>
      {view.name === "list" && <Workshops onOpen={(id) => setView({ name: "checkout", id })} />}
      {view.name === "signup" && <Signup onDone={() => setView({ name: "list" })} />}
      {view.name === "checkout" && <Checkout workshopId={view.id} />}
    </main>
  );
}
