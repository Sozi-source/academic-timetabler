// ============================================================
// Lecture Notes — Gemini Embedding Client
// ============================================================
// Uses text-embedding-004 (768 dimensions) for all chunk embeddings
// and topic query embeddings.

import { GoogleGenerativeAI } from '@google/generative-ai';

function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY environment variable is not set. ' +
      'Add it to .env.local to enable lecture note generation.'
    );
  }
  return new GoogleGenerativeAI(apiKey);
}

const EMBEDDING_MODEL = 'text-embedding-004';

/**
 * Generates a 768-dimensional embedding for a single text string.
 * Used for both chunk ingestion and topic query lookups.
 */
export async function embedText(text: string): Promise<number[]> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });

  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
  });

  return result.embedding.values;
}

/**
 * Generates embeddings for multiple texts in a single batch call.
 * Gemini supports batch embedding for efficiency.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });

  // Batch embed (max 100 per request — chunk if needed)
  const BATCH_SIZE = 100;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await model.batchEmbedContents({
      requests: batch.map((text) => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: { role: 'user', parts: [{ text }] },
      })),
    });
    results.push(...response.embeddings.map((e) => e.values));
  }

  return results;
}
