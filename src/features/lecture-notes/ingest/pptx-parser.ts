// ============================================================
// Lecture Notes — PPTX (PowerPoint) Text Extractor
// ============================================================
// Uses the application's existing JSZip dependency to parse OPC
// (Open Packaging Conventions) PowerPoint presentation archives (.pptx).
// Extracts text per slide and paragraph, decoding XML entities.

import type JSZip from 'jszip';

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  let JSZipConstructor: typeof JSZip;
  try {
    const imported = await import('jszip');
    JSZipConstructor = ((imported as unknown as { default?: typeof JSZip }).default ?? imported) as unknown as typeof JSZip;
  } catch {
    throw new Error('ZIP support is not available in this deployment.');
  }

  let archive: JSZip;
  try {
    archive = await JSZipConstructor.loadAsync(buffer, {
      createFolders: false,
      checkCRC32: false,
    });
  } catch (err) {
    throw new Error(`Could not parse PowerPoint presentation: ${err instanceof Error ? err.message : String(err)}`);
  }

  const slideFiles = Object.keys(archive.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      return numA - numB;
    });

  if (slideFiles.length === 0) {
    return '';
  }

  const slidesText: string[] = [];

  for (const slidePath of slideFiles) {
    const slideNumber = slidePath.match(/slide(\d+)\.xml/i)?.[1] || '';
    const file = archive.files[slidePath];
    if (!file) continue;

    const xml = await file.async('text');
    const paragraphs = xml.match(/<a:p\b[^>]*>[\s\S]*?<\/a:p>/g) || [];
    const paragraphTexts: string[] = [];

    for (const para of paragraphs) {
      const textMatches = Array.from(para.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g)).map((m) => m[1]);
      const combined = textMatches.join('').trim();
      if (combined) {
        paragraphTexts.push(decodeXmlEntities(combined));
      }
    }

    if (paragraphTexts.length > 0) {
      slidesText.push(`--- Slide ${slideNumber} ---\n${paragraphTexts.join('\n')}`);
    }
  }

  return slidesText.join('\n\n');
}
