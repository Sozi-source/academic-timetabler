// ============================================================
// Lecture Notes — ZIP Source Archive Extractor
// ============================================================
// Uses the application's existing JSZip dependency so ZIP files created by
// Windows/macOS/Office tooling, including archives that use data descriptors,
// are handled correctly. The archive is a source container, not a single
// semantic document: every supported member is extracted and read in full.

import type JSZip from 'jszip';

export interface ZipSourceEntry {
  filename: string;
  buffer: Buffer;
}

const MAX_ENTRIES = 100;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 150 * 1024 * 1024;
const MAX_ENTRY_UNCOMPRESSED_BYTES = 30 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(['pdf', 'docx', 'txt', 'md']);

function safeFilename(filename: string): string | null {
  const normalized = filename.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.endsWith('/')) return null;
  if (normalized.split('/').some((part) => part === '..')) return null;
  if (normalized.startsWith('__MACOSX/')) return null;
  return normalized;
}

export async function unpackLectureSourceZip(zipBuffer: Buffer): Promise<ZipSourceEntry[]> {
  let JSZipConstructor: typeof JSZip;
  try {
    const imported = await import('jszip');
    JSZipConstructor = ((imported as unknown as { default?: typeof JSZip }).default ?? imported) as unknown as typeof JSZip;
  } catch {
    throw new Error('ZIP support is not available in this deployment. Install the jszip package before using ZIP uploads.');
  }

  let archive: JSZip;
  try {
    archive = await JSZipConstructor.loadAsync(zipBuffer, {
      createFolders: false,
      checkCRC32: true,
    });
  } catch (error) {
    throw new Error(`Could not open ZIP archive: ${error instanceof Error ? error.message : String(error)}`);
  }

  const files = Object.values(archive.files).filter((entry) => !entry.dir);
  if (files.length === 0) {
    throw new Error('The ZIP archive is empty.');
  }
  if (files.length > MAX_ENTRIES) {
    throw new Error(`The ZIP contains ${files.length} files. The maximum is ${MAX_ENTRIES} source files per archive.`);
  }

  const entries: ZipSourceEntry[] = [];
  let totalBytes = 0;

  for (const entry of files) {
    const filename = safeFilename(entry.name);
    if (!filename) continue;
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

    let buffer: Buffer;
    try {
      buffer = await entry.async('nodebuffer');
    } catch (error) {
      throw new Error(`Could not extract ${filename}: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (buffer.length > MAX_ENTRY_UNCOMPRESSED_BYTES) {
      throw new Error(`${filename} expands beyond the 30 MB per-file ZIP limit.`);
    }

    totalBytes += buffer.length;
    if (totalBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new Error('The ZIP archive expands beyond the 150 MB total extraction limit.');
    }

    entries.push({ filename, buffer });
  }

  if (entries.length === 0) {
    throw new Error('The ZIP contains no supported lecture-source files. Include PDF, DOCX, TXT or Markdown files.');
  }

  return entries;
}
