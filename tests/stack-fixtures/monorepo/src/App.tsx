import { useState } from "react";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "node:fs";
import { helper } from "unlisted-lib";
import { api } from "@acme/api";

export function App() {
  const [n] = useState(0);
  return <div title="Crédits &">Crédits & sources {n}</div>;
}
