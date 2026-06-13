import { readResponseJson } from "../lib/api-json";
import { obsidianFetch } from "../lib/obsidian-fetch";

/**
 * Parse a timestamp string from ScreenPipe into a Date.
 * Handles: ISO 8601 (with or without Z), ISO without timezone (treated as UTC),
 * Unix seconds (10 digits), Unix milliseconds (13 digits).
 * Use this so we never show wrong dates (e.g. 01/27 when it should be 02/03)
 * due to mis-parsing numeric or timezone-ambiguous values.
 */
export function parseScreenpipeTimestamp(ts: string): Date {
  const s = ts.trim();
  if (/^\d{10}$/.test(s)) {
    return new Date(parseInt(s, 10) * 1000);
  }
  if (/^\d{13}$/.test(s)) {
    return new Date(parseInt(s, 10));
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/i.test(s)) {
    return new Date(`${s}Z`);
  }
  return new Date(ts);
}

export interface ScreenpipeSearchParams {
  q?: string;
  content_type?: "all" | "ocr" | "ocr+ui" | "audio" | "audio+ocr" | "vision";
  limit?: number;
  start_time?: string;
  end_time?: string;
  app_name?: string;
  window_name?: string;
  browser_url?: string;
}

export interface ScreenpipeSearchOptions {
  /** When true, allow limit up to 500 (e.g. for Meetings tab). Default cap remains 50. */
  allowHigherLimit?: boolean;
}

export interface ScreenpipeResult {
  type: "OCR" | "Audio";
  content: {
    text?: string;
    transcription?: string;
    timestamp: string;
    app_name?: string;
    window_name?: string;
    file_path?: string;
    audio_file_path?: string;
    url?: string; // URL if available (e.g., YouTube video URL, webpage URL)
    browser_url?: string; // Browser tab URL (reliable for in-browser Meet/Teams etc.)
  };
}

export class ScreenpipeClient {
  constructor(private apiUrl: string = "http://localhost:3030") {}

  /**
   * Check if ScreenPipe API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await obsidianFetch(`${this.apiUrl}/health`, {
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Search ScreenPipe for recorded content.
   * @param options.allowHigherLimit - When true (Meetings tab only), allow limit up to 500. Default cap is 50.
   */
  async search(
    params: ScreenpipeSearchParams,
    options?: ScreenpipeSearchOptions
  ): Promise<ScreenpipeResult[]> {
    try {
      const searchParams = new URLSearchParams();

      if (params.q) {
        searchParams.append("q", params.q);
      }
      if (params.content_type && params.content_type !== "all") {
        searchParams.append("content_type", params.content_type);
      }
      const maxLimit = options?.allowHigherLimit ? 500 : 50;
      searchParams.append(
        "limit",
        String(Math.min(params.limit || 10, maxLimit))
      );
      if (params.start_time) {
        searchParams.append("start_time", params.start_time);
      }
      if (params.end_time) {
        searchParams.append("end_time", params.end_time);
      }
      if (params.app_name) {
        searchParams.append("app_name", params.app_name);
      }
      if (params.window_name) {
        searchParams.append("window_name", params.window_name);
      }
      if (params.browser_url) {
        searchParams.append("browser_url", params.browser_url);
      }

      const response = await obsidianFetch(
        `${this.apiUrl}/search?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(`ScreenPipe API error: ${response.status}`);
      }

      const data = await readResponseJson<{ data?: ScreenpipeResult[] }>(response);
      return data.data ?? [];
    } catch {
      // Return empty array on error - handler will show appropriate message
      return [];
    }
  }
}
