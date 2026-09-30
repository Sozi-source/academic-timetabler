// ============================================================
// Lecture Notes — Gemini Generation Client
// ============================================================
// Calls Gemini 1.5 Pro with the grounded prompt.
// Parses the markdown response into structured sections.

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GeneratedSection, LectureNotesDocument } from '../types';

const GENERATION_MODEL = 'gemini-1.5-pro';

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');
  return new GoogleGenerativeAI(apiKey);
}

export interface GeminiGenerationInput {
  prompt: string;
  unitCode: string;
  unitName: string;
  topic: string;
  granularity: 'session' | 'unit';
  sessionWeek?: number | null;
  sourceMaterialTitles: string[];
}

/**
 * Calls Gemini 1.5 Pro with the grounded prompt and returns a
 * structured LectureNotesDocument parsed from the markdown response.
 */
export async function generateLectureNotes(
  input: GeminiGenerationInput
): Promise<{ document: LectureNotesDocument; promptTokens: number; outputTokens: number }> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: GENERATION_MODEL,
    generationConfig: {
      temperature: 0.1,  // Low temperature = minimal creative drift
      topP: 0.8,
      maxOutputTokens: 8192,
    },
  });

  const result = await model.generateContent(input.prompt);
  const response = result.response;
  const markdown = response.text();

  const usage = response.usageMetadata;
  const promptTokens = usage?.promptTokenCount ?? 0;
  const outputTokens = usage?.candidatesTokenCount ?? 0;

  const sections = parseMarkdownIntoSections(markdown);

  return {
    document: {
      unitCode: input.unitCode,
      unitName: input.unitName,
      topic: input.topic,
      granularity: input.granularity,
      sessionWeek: input.sessionWeek ?? null,
      sections,
      generatedAt: new Date().toISOString(),
      sourceMaterials: input.sourceMaterialTitles,
    },
    promptTokens,
    outputTokens,
  };
}

/**
 * Parses Gemini's markdown output into section objects.
 * Handles H2 headings as section boundaries.
 */
function parseMarkdownIntoSections(markdown: string): GeneratedSection[] {
  const lines = markdown.split('\n');
  const sections: GeneratedSection[] = [];

  let currentHeading = '';
  let currentBody: string[] = [];

  for (const line of lines) {
    // H1 is the document title — skip
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      continue;
    }
    // H2 = new section
    if (line.startsWith('## ')) {
      if (currentHeading) {
        sections.push({
          heading: currentHeading,
          body: currentBody.join('\n').trim(),
        });
      }
      currentHeading = line.replace(/^## /, '').trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  // Flush the last section
  if (currentHeading) {
    sections.push({
      heading: currentHeading,
      body: currentBody.join('\n').trim(),
    });
  }

  // If no H2 sections found, treat entire response as a single section
  if (sections.length === 0 && markdown.trim()) {
    sections.push({
      heading: 'Content',
      body: markdown.trim(),
    });
  }

  return sections;
}
