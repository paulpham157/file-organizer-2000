// Mock Obsidian API for testing

export class Notice {
  constructor(public message: string, public timeout?: number) {}
}

export interface RequestUrlResponse {
  status: number;
  json: unknown;
  headers?: Record<string, string>;
}

export async function requestUrl(options: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<RequestUrlResponse> {
  // This will be mocked in individual tests
  throw new Error('requestUrl should be mocked in tests');
}

// Mock other Obsidian types as needed
export class Plugin {}
export class TFile {
  path: string;
  basename: string;
  extension: string;
  constructor(path: string) {
    this.path = path;
    this.basename = path.split('/').pop() || path;
    this.extension = path.split('.').pop() || '';
  }
}
export class TFolder {
  path: string;
  constructor(path: string) {
    this.path = path;
  }
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export const moment = {
  format: (format?: string) => format || 'YYYY-MM-DD',
  toISOString: () => new Date().toISOString(),
};

export function loadPdfJs(): Promise<unknown> {
  return Promise.resolve({});
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export type CachedMetadata = Record<string, never>;
export type LinkCache = Record<string, never>;

