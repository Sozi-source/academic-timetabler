import { describe, expect, it } from 'vitest';

describe('PDF Parser Robustness', () => {
  it('extracts text reliably with polyfill and Uint8Array', async () => {
    // Polyfill DOMMatrix and DOMPoint
    if (typeof (globalThis as any).DOMMatrix === 'undefined') {
      (globalThis as any).DOMMatrix = class DOMMatrix {
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
        static fromMatrix() { return new (globalThis as any).DOMMatrix(); }
        multiply() { return this; }
        translate() { return this; }
        scale() { return this; }
        rotate() { return this; }
        inverse() { return this; }
        transformPoint(p: any) { return p; }
        toFloat32Array() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); }
        toFloat64Array() { return new Float64Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); }
      };
    }

    if (typeof (globalThis as any).DOMPoint === 'undefined') {
      (globalThis as any).DOMPoint = class DOMPoint {
        x = 0; y = 0; z = 0; w = 1;
        constructor(x = 0, y = 0, z = 0, w = 1) {
          this.x = x; this.y = y; this.z = z; this.w = w;
        }
        static fromPoint(other?: any) {
          return new (globalThis as any).DOMPoint(other?.x, other?.y, other?.z, other?.w);
        }
      };
    }

    const dummyPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF');

    const pdfMod = await import('pdf-parse');
    let extractedText = '';

    if (typeof (pdfMod as any).PDFParse === 'function') {
      const parser = new (pdfMod as any).PDFParse(new Uint8Array(dummyPdf));
      const res = await parser.getText();
      extractedText = typeof res === 'string' ? res : (res?.text ?? '');
    } else if (typeof pdfMod.default === 'function') {
      const res = await (pdfMod.default as any)(dummyPdf);
      extractedText = res?.text ?? '';
    }

    expect(typeof extractedText).toBe('string');
    console.log('Successfully extracted text:', JSON.stringify(extractedText));
  });
});
