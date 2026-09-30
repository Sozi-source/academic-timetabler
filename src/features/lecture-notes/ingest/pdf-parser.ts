// ============================================================
// Lecture Notes — PDF Text Extractor
// ============================================================
// Uses pdf-parse (Node.js runtime only — NOT edge compatible)

/**
 * Extracts plain text from a PDF file buffer.
 * Returns empty string if the PDF has no extractable text (scanned image).
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Dynamic import keeps this out of the client bundle
  const pdfParse = (await import('pdf-parse')).default;
  try {
    const result = await pdfParse(buffer);
    return result.text ?? '';
  } catch (err) {
    throw new Error(`PDF text extraction failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
