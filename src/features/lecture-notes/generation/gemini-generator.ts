// ============================================================
// Lecture Notes — Gemini Generation Client
// ============================================================
// Generates structured lecture notes using Google Gemini.
// Parses markdown responses into standard sections.
// Retry strategy: try each model in order; on transient errors
// (503 / 429) apply exponential backoff before the next attempt.

import type { GeneratedSection, LectureNotesDocument } from '../types';
import { getGeminiApiKey } from '../lib/gemini-api-key';

/** Ordered model list — first available & healthy wins. */
const MODEL_POOL = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.8-flash'] as const;

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Status codes that indicate a transient server-side issue and should trigger backoff. */
const TRANSIENT_STATUS_CODES = new Set([429, 503, 500, 502, 504]);


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
  const apiKey = getGeminiApiKey();

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
      const err = new Error(`Gemini API error (${modelName} - ${response.status}): ${errorText}`);
      Object.assign(err, { isTransient: TRANSIENT_STATUS_CODES.has(response.status) });
      throw err;
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

  let resultData: {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
  } | null = null;

  let lastError: Error | null = null;

  for (let i = 0; i < MODEL_POOL.length; i++) {
    const model = MODEL_POOL[i];
    try {
      resultData = await callGemini(model);
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[gemini-generator] Model ${model} failed (attempt ${i + 1}/${MODEL_POOL.length}):`, lastError.message);
      if (i < MODEL_POOL.length - 1) {
        const isTransient = (err as { isTransient?: boolean })?.isTransient ?? true;
        const delayMs = isTransient ? 1500 * (i + 1) : 400;
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  }

  if (!resultData) {
    throw lastError ?? new Error('All Gemini models failed to generate content. Please try again.');
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
