import { useState, type FormEvent } from "react";
import { signup } from "../api/auth";

export function Signup({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ email: "", name: "", phone: "", password: "" });
  async function submit(e: FormEvent) {
    e.preventDefault();
    await signup({ ...form, phone: form.phone || undefined });
    onDone();
  }
  return (
    <form onSubmit={submit}>
      {(["email", "name", "phone", "password"] as const).map((k) => (
        <input key={k} placeholder={k} type={k === "password" ? "password" : "text"} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      ))}
      <button>Créer mon compte</button>
    </form>
  );
}
