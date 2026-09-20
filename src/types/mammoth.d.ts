declare module 'mammoth' {
  export interface MammothMessage {
    type: 'warning' | 'error';
    message: string;
  }

  export interface MammothResult {
    value: string;
    messages: MammothMessage[];
  }

  export interface ConvertInputOptions {
    buffer?: Buffer;
    path?: string;
    arrayBuffer?: ArrayBuffer;
  }

  export function convertToHtml(
    input: ConvertInputOptions,
    options?: Record<string, unknown>,
  ): Promise<MammothResult>;

  export function extractRawText(
    input: ConvertInputOptions,
    options?: Record<string, unknown>,
  ): Promise<MammothResult>;

  export function convertToMarkdown(
    input: ConvertInputOptions,
    options?: Record<string, unknown>,
  ): Promise<MammothResult>;

  const mammoth: {
    convertToHtml: typeof convertToHtml;
    extractRawText: typeof extractRawText;
    convertToMarkdown: typeof convertToMarkdown;
  };

  export default mammoth;
}
