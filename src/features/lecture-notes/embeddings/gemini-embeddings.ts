// ============================================================
// Lecture Notes — Gemini Embedding Client
// ============================================================
// Uses gemini-embedding-001 with outputDimensionality: 768
// to align with Supabase pgvector column vector(768).

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY environment variable is not set. ' +
      'Add it to .env.local to enable lecture note generation.'
    );
  }
  return apiKey;
}

/**
 * Generates a 768-dimensional embedding for a single text string.
 * Used for both chunk ingestion and topic query lookups.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = getApiKey();
  const url = `${GEMINI_API_URL}/gemini-embedding-001:embedContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Embedding API error (${res.status}): ${errorBody}`);
  }

  const data = (await res.json()) as { embedding: { values: number[] } };
  return data.embedding.values;
}

/**
 * Generates embeddings for multiple texts in batches.
 * Uses outputDimensionality: 768 to ensure database compatibility.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const apiKey = getApiKey();
  const url = `${GEMINI_API_URL}/gemini-embedding-001:batchEmbedContents?key=${apiKey}`;

  const BATCH_SIZE = 50;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: batch.map((text) => ({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text }] },
          outputDimensionality: 768,
        })),
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Batch embedding API error (${res.status}): ${errorBody}`);
    }

    const data = (await res.json()) as { embeddings: Array<{ values: number[] }> };
    results.push(...data.embeddings.map((e) => e.values));
  }

  return results;
}
