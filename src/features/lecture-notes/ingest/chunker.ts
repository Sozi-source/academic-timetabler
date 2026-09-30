// ============================================================
// Lecture Notes — Text Chunker
// Splits extracted text into overlapping chunks for embedding.
// ============================================================

const CHUNK_TOKENS = 400;
const OVERLAP_TOKENS = 50;

/**
 * Naively approximates token count as word count × 1.3
 * (close enough for chunking purposes without a tokenizer dependency).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.3);
}

/**
 * Splits text into overlapping chunks of ~CHUNK_TOKENS tokens.
 * Uses paragraph boundaries where possible for cleaner splits.
 */
export function chunkText(text: string): string[] {
  if (!text.trim()) return [];

  // Split on double newlines (paragraph boundaries) first
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    // If a single paragraph exceeds chunk size, split it by sentence
    if (paraTokens > CHUNK_TOKENS) {
      // Flush current buffer first
      if (current.length > 0) {
        chunks.push(current.join('\n\n'));
        current = [];
        currentTokens = 0;
      }
      // Split oversized paragraph into sentences
      const sentences = para.split(/(?<=[.?!])\s+/);
      let sentBuffer: string[] = [];
      let sentTokens = 0;
      for (const sentence of sentences) {
        const st = estimateTokens(sentence);
        if (sentTokens + st > CHUNK_TOKENS && sentBuffer.length > 0) {
          chunks.push(sentBuffer.join(' '));
          // Keep last OVERLAP_TOKENS worth for context continuity
          const overlap = keepTailTokens(sentBuffer, OVERLAP_TOKENS);
          sentBuffer = overlap;
          sentTokens = estimateTokens(sentBuffer.join(' '));
        }
        sentBuffer.push(sentence);
        sentTokens += st;
      }
      if (sentBuffer.length > 0) {
        chunks.push(sentBuffer.join(' '));
      }
      continue;
    }

    if (currentTokens + paraTokens > CHUNK_TOKENS && current.length > 0) {
      chunks.push(current.join('\n\n'));
      // Overlap: carry last paragraph(s) into next chunk for context
      const overlap = keepTailTokens(current, OVERLAP_TOKENS);
      current = overlap;
      currentTokens = estimateTokens(current.join('\n\n'));
    }

    current.push(para);
    currentTokens += paraTokens;
  }

  if (current.length > 0) {
    chunks.push(current.join('\n\n'));
  }

  return chunks.filter((c) => c.trim().length > 0);
}

function keepTailTokens(items: string[], tokenTarget: number): string[] {
  let total = 0;
  const result: string[] = [];
  for (let i = items.length - 1; i >= 0; i--) {
    const t = estimateTokens(items[i]);
    if (total + t > tokenTarget) break;
    result.unshift(items[i]);
    total += t;
  }
  return result;
}
