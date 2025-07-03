import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

export async function embedText(text: string): Promise<number[]> {
  if (!apiKey) {
    throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY env var for embeddings");
  }

  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.embedContent({
    model: "gemini-embedding-exp-03-07",
    contents: text,
    config: { outputDimensionality: 1536 },
  });
  // The SDK returns either {embedding: {values: Float32Array}} or {embeddings: [{values: Float32Array}]}
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const values = (
    (Array.isArray((res as any).embeddings)
      ? (res as any).embeddings[0]?.values
      : (res as any).embedding?.values) || []
  ) as number[];
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (!values.length) {
    throw new Error("Failed to obtain embedding values from GoogleGenAI response");
  }

  if (values.length > 1536) {
    return Array.from(values.slice(0, 1536));
  }
  if (values.length < 1536) {
    throw new Error(`Unexpected embedding dimensionality ${values.length}; expected 1536`);
  }

  return Array.from(values);
} 