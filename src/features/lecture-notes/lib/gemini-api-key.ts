// ============================================================
// Lecture Notes — Resilient Gemini API Key Resolver
// ============================================================
// Resolves the Gemini API key with multi-tiered fallback:
// 1. process.env.GEMINI_API_KEY / GOOGLE_API_KEY / GOOGLE_AI_API_KEY
// 2. Direct runtime read of .env.local / .env from disk
//    (guarantees key resolution even if the Next.js dev server
//     was started before .env.local was created/updated)
// ============================================================

import fs from 'node:fs';
import path from 'node:path';

export function getGeminiApiKey(): string {
  // 1. Direct process.env check
  const fromEnv =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim();

  if (fromEnv) {
    return fromEnv;
  }

  // 2. Resilient disk fallback: parse .env.local or .env
  try {
    const candidateFiles = [
      path.join(process.cwd(), '.env.local'),
      path.join(process.cwd(), '.env'),
    ];

    for (const filePath of candidateFiles) {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
          const [rawKey, ...rest] = trimmed.split('=');
          const keyName = rawKey?.trim();
          const rawValue = rest.join('=').trim().replace(/^["']|["']$/g, '');

          if (
            (keyName === 'GEMINI_API_KEY' ||
             keyName === 'GOOGLE_API_KEY' ||
             keyName === 'GOOGLE_AI_API_KEY') &&
            rawValue
          ) {
            // Cache to process.env so subsequent requests are instantaneous
            process.env.GEMINI_API_KEY = rawValue;
            return rawValue;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[gemini-api-key] Error reading env files from disk:', err);
  }

  throw new Error('GEMINI_API_KEY is not set. Please check your .env.local configuration.');
}
