// ============================================================
// Lecture Notes — PDF Text Extractor
// ============================================================
// Uses pdf-parse (Node.js runtime only — NOT edge compatible).
// Includes polyfills for DOMMatrix and DOMPoint required by pdfjs-dist
// in Node.js server environments.

function ensurePolyfills() {
  if (typeof (globalThis as unknown as { DOMMatrix?: unknown }).DOMMatrix === 'undefined') {
    (globalThis as unknown as { DOMMatrix: unknown }).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true;
      isIdentity = true;
      constructor(init?: string | number[]) {
        if (Array.isArray(init) && init.length >= 6) {
          this.a = this.m11 = init[0];
          this.b = this.m12 = init[1];
          this.c = this.m21 = init[2];
          this.d = this.m22 = init[3];
          this.e = this.m41 = init[4];
          this.f = this.m42 = init[5];
        }
      }
      static fromMatrix() { return new (globalThis as unknown as { DOMMatrix: new () => unknown }).DOMMatrix(); }
      multiply() { return this; }
      translate() { return this; }
      scale() { return this; }
      rotate() { return this; }
      inverse() { return this; }
      transformPoint(p: unknown) { return p; }
      toFloat32Array() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
      toFloat64Array() { return new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
    };
  }

  if (typeof (globalThis as unknown as { DOMPoint?: unknown }).DOMPoint === 'undefined') {
    (globalThis as unknown as { DOMPoint: unknown }).DOMPoint = class DOMPoint {
      x = 0; y = 0; z = 0; w = 1;
      constructor(x = 0, y = 0, z = 0, w = 1) {
        this.x = x; this.y = y; this.z = z; this.w = w;
      }
      static fromPoint(other?: { x?: number; y?: number; z?: number; w?: number }) {
        return new (globalThis as unknown as { DOMPoint: new (x?: number, y?: number, z?: number, w?: number) => unknown }).DOMPoint(
          other?.x,
          other?.y,
          other?.z,
          other?.w
        );
      }
    };
  }
}

/**
 * Extracts plain text from a PDF file buffer.
 * Returns empty string if the PDF has no extractable text (e.g. scanned images without OCR).
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  ensurePolyfills();

  try {
    const pdfMod = await import('pdf-parse');

    // Handle pdf-parse v2.x (class PDFParse with Uint8Array input)
    if (typeof (pdfMod as unknown as { PDFParse?: unknown }).PDFParse === 'function') {
      const PDFParseClass = (pdfMod as unknown as { PDFParse: new (data: Uint8Array) => { getText: () => Promise<string | { text?: string }> } }).PDFParse;
      const parser = new PDFParseClass(new Uint8Array(buffer));
      const res = await parser.getText();
      return typeof res === 'string' ? res : (res?.text ?? '');
    }

    // Handle pdf-parse v1.x (default function taking Buffer)
    if (typeof pdfMod.default === 'function') {
      const res = await (pdfMod.default as (b: Buffer) => Promise<{ text?: string }>)(buffer);
      return res?.text ?? '';
    }

    // Handle generic function export
    if (typeof pdfMod === 'function') {
      const res = await (pdfMod as unknown as (b: Buffer) => Promise<{ text?: string }>)(buffer);
      return res?.text ?? '';
    }

    throw new Error('Unsupported pdf-parse module export structure');
  } catch (err) {
    throw new Error(`PDF text extraction failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
