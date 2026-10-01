// Type declarations for pdf-parse and mammoth
// (neither ships @types/* packages)

declare module 'pdf-parse' {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    text: string;
    version: string;
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: Record<string, unknown>
  ): Promise<PDFData>;

  export = pdfParse;
}

declare module 'mammoth' {
  interface ExtractResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  interface MammothOptions {
    buffer?: Buffer;
    path?: string;
    arrayBuffer?: ArrayBuffer;
  }

  export function extractRawText(input: MammothOptions): Promise<ExtractResult>;
  export function convertToHtml(input: MammothOptions): Promise<ExtractResult>;
}
