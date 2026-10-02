import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getGeminiApiKey } from '@/features/lecture-notes/lib/gemini-api-key';

describe('getGeminiApiKey', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('resolves directly from process.env.GEMINI_API_KEY if present', () => {
    process.env.GEMINI_API_KEY = 'test-key-direct';
    expect(getGeminiApiKey()).toBe('test-key-direct');
  });

  it('resolves from process.env.GOOGLE_API_KEY fallback', () => {
    process.env.GOOGLE_API_KEY = 'test-key-google';
    expect(getGeminiApiKey()).toBe('test-key-google');
  });

  it('falls back to disk reading .env.local when process.env is unpopulated', () => {
    // Both env vars are deleted in beforeEach
    const key = getGeminiApiKey();
    expect(key).toBeDefined();
    expect(key.length).toBeGreaterThan(10);
    expect(key.startsWith('AIzaSy')).toBe(true);
  });
});
