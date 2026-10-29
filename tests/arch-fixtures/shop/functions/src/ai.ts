import { GoogleGenAI } from "@google/genai";

export function summarize(text: string) {
  const client = new GoogleGenAI({ apiKey: process.env.KEY });
  return client.models.generateContent({ model: "gemini-3.5-flash", contents: text });
}
