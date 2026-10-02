// ============================================================
// Lecture Notes — DOCX Text Extractor
// ============================================================
// Uses mammoth (Node.js runtime only — NOT edge compatible)

/**
 * Extracts plain text from a DOCX file buffer.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammothMod = await import('mammoth');
  const mammoth = (mammothMod as unknown as { default?: { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> }; extractRawText?: (opts: { buffer: Buffer }) => Promise<{ value: string }> }).default ?? mammothMod;
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? '';
  } catch (err) {
    throw new Error(`DOCX text extraction failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
