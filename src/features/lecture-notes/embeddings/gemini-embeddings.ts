// ============================================================
// Lecture Notes — Gemini Embedding Client
// ============================================================
// Uses text-embedding-004 (or legacy embedding-001) with outputDimensionality: 768
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
 * Uses text-embedding-004 with fallback to embedding-001.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = getApiKey();
  const models = ['text-embedding-004', 'embedding-001'];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const url = `${GEMINI_API_URL}/${model}:embedContent?key=${apiKey}`;
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
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('Failed to generate embedding');
}

/**
 * Generates embeddings for multiple texts in batches.
 * Uses outputDimensionality: 768 to ensure database compatibility.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const apiKey = getApiKey();
  const models = ['text-embedding-004', 'embedding-001'];
  const BATCH_SIZE = 50;

  for (const model of models) {
    try {
      const url = `${GEMINI_API_URL}/${model}:batchEmbedContents?key=${apiKey}`;
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: batch.map((text) => ({
              model: `models/${model}`,
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
    } catch (err) {
      console.warn(`[lecture-notes/embedTexts] Failed with ${model}, trying fallback:`, err);
    }
  }

  throw new Error('All embedding models failed');
}
