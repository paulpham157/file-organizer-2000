/** Safety net for tool results sent back into the model (chat history). */
export const DEFAULT_MAX_TOOL_RESULT_UTF16 = 120_000;

const JSON_TRUNCATION_KEYS = {
  truncated: true,
  _note: "Tool result exceeded max length; preview only.",
} as const;

/**
 * Hard-cap a string for tool callbacks (plain text errors, etc.).
 */
export function truncateStringForToolResult(
  str: string,
  maxUtf16Units: number
): { text: string; truncated: boolean } {
  if (maxUtf16Units < 1) {
    return { text: "", truncated: str.length > 0 };
  }
  if (str.length <= maxUtf16Units) {
    return { text: str, truncated: false };
  }
  const marker = "\n[...truncated]";
  /* If the suffix does not fit, hard-slice without a marker so length never exceeds max. */
  if (maxUtf16Units <= marker.length) {
    return { text: str.slice(0, maxUtf16Units), truncated: true };
  }
  const take = maxUtf16Units - marker.length;
  return { text: str.slice(0, take) + marker, truncated: true };
}

/**
 * Stringify then shrink. If over budget, return valid JSON with preview (never broken JSON).
 */
export function capJsonStringified(
  payload: unknown,
  maxUtf16Units: number
): string {
  const raw = JSON.stringify(payload);
  if (raw.length <= maxUtf16Units) {
    return raw;
  }
  const overhead = 120;
  const previewBudget = Math.max(256, maxUtf16Units - overhead);
  const { text: preview } = truncateStringForToolResult(raw, previewBudget);
  return JSON.stringify({
    ...JSON_TRUNCATION_KEYS,
    originalLength: raw.length,
    preview,
  });
}

/**
 * Cap any tool result string: keeps valid JSON when possible.
 */
export function capToolResultString(
  result: string,
  maxUtf16Units: number = DEFAULT_MAX_TOOL_RESULT_UTF16
): string {
  if (result.length <= maxUtf16Units) {
    return result;
  }
  try {
    const parsed: unknown = JSON.parse(result);
    return capJsonStringified(parsed, maxUtf16Units);
  } catch {
    return truncateStringForToolResult(result, maxUtf16Units).text;
  }
}
