// ============================================================
// Lecture Notes — Deterministic Unified Source Consolidator
// ============================================================
// This is the reliable path for "read every source and unify it".
// It does NOT use vector retrieval or an LLM to decide which source
// passages survive. Every ready material is read in full; exact
// duplicate paragraphs are removed; materially different content is kept.

import type { GeneratedSection, LectureMaterial, LectureNotesDocument } from '../types';

export interface UnifiedSourceStats {
  materialCount: number;
  sourceWordCount: number;
  retainedWordCount: number;
  duplicateParagraphCount: number;
}

function cleanText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeParagraph(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function looksLikeHeading(line: string): boolean {
  const text = cleanText(line);
  if (!text || text.length > 180) return false;
  if (/^(lesson|module|chapter|unit)\s+\d+/i.test(text)) return true;
  if (/^\d+(\.\d+)*[.)]?\s+[A-Za-z]/.test(text)) return true;
  if (/^[A-Z][A-Z0-9 &/(),:'’\-–—]{5,}$/.test(text) && text.split(/\s+/).length <= 14) return true;
  if (/^(learning objectives|introduction|key definitions|lesson summary|references|further reading|assessment|summary)$/i.test(text)) return true;
  return false;
}

function headingKey(value: string): string {
  return normalizeParagraph(value).replace(/^\d+(?:\.\d+)*\s*/, '');
}

function addParagraph(section: GeneratedSection, paragraph: string): void {
  if (!paragraph.trim()) return;
  section.body = section.body ? `${section.body}\n\n${paragraph.trim()}` : paragraph.trim();
}

export function buildUnifiedLectureNotesDocument(input: {
  unitCode: string;
  unitName: string;
  topic: string;
  sessionWeek?: number | null;
  materials: LectureMaterial[];
}): { document: LectureNotesDocument; stats: UnifiedSourceStats } {
  const readyMaterials = input.materials.filter((material) =>
    Boolean(
      (material.ingestedAt || (material as unknown as { ingested_at?: string }).ingested_at) &&
      (material.contentText?.trim() || (material as unknown as { content_text?: string }).content_text?.trim())
    )
  );
  const sourceMaterials = readyMaterials.map((material) => material.title);
  const sectionsByKey = new Map<string, GeneratedSection>();
  const sectionOrder: string[] = [];
  const seenParagraphs = new Set<string>();
  let sourceWordCount = 0;
  let retainedWordCount = 0;
  let duplicateParagraphCount = 0;

  function getSection(heading: string): GeneratedSection {
    const cleanHeading = cleanText(heading) || 'Additional Source Content';
    const key = headingKey(cleanHeading) || 'additional source content';
    const existing = sectionsByKey.get(key);
    if (existing) return existing;
    const section: GeneratedSection = { heading: cleanHeading, body: '' };
    sectionsByKey.set(key, section);
    sectionOrder.push(key);
    return section;
  }

  for (const material of readyMaterials) {
    const rawContent = material.contentText || (material as unknown as { content_text?: string }).content_text || '';
    const content = cleanText(rawContent);
    sourceWordCount += wordCount(content);

    let current = getSection('Unified Source Content');
    const lines = content.split(/\n+/).map(cleanText).filter(Boolean);

    for (const line of lines) {
      if (looksLikeHeading(line)) {
        current = getSection(line);
        continue;
      }

      // Keep list/table-like lines together as source content rather than
      // trying to semantically rewrite them.
      const paragraphs = line.split(/\n\s*\n/).map(cleanText).filter(Boolean);
      for (const paragraph of paragraphs) {
        const key = normalizeParagraph(paragraph);
        if (!key || key.length < 4) continue;
        if (seenParagraphs.has(key)) {
          duplicateParagraphCount += 1;
          continue;
        }
        seenParagraphs.add(key);
        addParagraph(current, paragraph);
        retainedWordCount += wordCount(paragraph);
      }
    }
  }

  // If heading detection was too sparse, keep a useful fallback section.
  const sections = sectionOrder
    .map((key) => sectionsByKey.get(key))
    .filter((section): section is GeneratedSection => Boolean(section?.body.trim()));

  const coverageBody = [
    `This unified version consolidates ${readyMaterials.length} ready source file${readyMaterials.length === 1 ? '' : 's'} for ${input.unitCode} — ${input.unitName}.`,
    `Approximately ${sourceWordCount.toLocaleString()} source words were read in full.`,
    `${duplicateParagraphCount.toLocaleString()} exact duplicate paragraph${duplicateParagraphCount === 1 ? '' : 's'} were removed; materially different content was retained.`,
  ].join('\n');

  sections.unshift({ heading: 'Source Coverage & Consolidation Method', body: coverageBody });

  sections.push({
    heading: 'Source Materials',
    body: sourceMaterials.map((title) => `- ${title}`).join('\n'),
  });

  return {
    document: {
      unitCode: input.unitCode,
      unitName: input.unitName,
      topic: input.topic,
      granularity: 'unit',
      sessionWeek: input.sessionWeek ?? null,
      sections,
      generatedAt: new Date().toISOString(),
      sourceMaterials,
    },
    stats: {
      materialCount: readyMaterials.length,
      sourceWordCount,
      retainedWordCount,
      duplicateParagraphCount,
    },
  };
}
