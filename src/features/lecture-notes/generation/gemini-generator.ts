// ============================================================
// Lecture Notes — Gemini Generation Client
// ============================================================
// Generates structured lecture notes using Google Gemini.
// Parses markdown responses into standard sections.

import type { GeneratedSection, LectureNotesDocument } from '../types';

const PRIMARY_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODEL = 'gemini-flash-latest';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Please check your .env.local configuration.');
  }
  return apiKey;
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
 * Calls Gemini with the grounded prompt and returns a
 * structured LectureNotesDocument parsed from the markdown response.
 */
export async function generateLectureNotes(
  input: GeminiGenerationInput
): Promise<{ document: LectureNotesDocument; promptTokens: number; outputTokens: number }> {
  const apiKey = getApiKey();

  async function callGemini(modelName: string) {
    const url = `${GEMINI_API_URL}/${modelName}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: input.prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.85,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${modelName} - ${response.status}): ${errorText}`);
    }

    return (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };
  }

  let resultData;
  try {
    resultData = await callGemini(PRIMARY_MODEL);
  } catch (primaryErr) {
    console.warn(`[gemini-generator] Primary model ${PRIMARY_MODEL} failed, trying fallback ${FALLBACK_MODEL}:`, primaryErr);
    resultData = await callGemini(FALLBACK_MODEL);
  }

  const candidate = resultData.candidates?.[0];
  const markdown = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

  if (!markdown.trim()) {
    throw new Error('Gemini returned an empty response. Please verify the topic and try again.');
  }

  const promptTokens = resultData.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = resultData.usageMetadata?.candidatesTokenCount ?? 0;

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
 * Handles H2 headings (## ...) as section boundaries.
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
