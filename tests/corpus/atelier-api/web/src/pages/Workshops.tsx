import { useEffect, useState } from "react";
import { listWorkshops, type Workshop } from "../api/workshops";

export function Workshops({ onOpen }: { onOpen: (id: string) => void }) {
  const [items, setItems] = useState<Workshop[]>([]);
  useEffect(() => {
    listWorkshops().then(setItems);
  }, []);
  return (
    <ul>
      {items.map((w) => (
        <li key={w.id}>
          <button onClick={() => onOpen(w.id)}>{w.title}</button> · {w.instructor}
        </li>
      ))}
    </ul>
  );
}
