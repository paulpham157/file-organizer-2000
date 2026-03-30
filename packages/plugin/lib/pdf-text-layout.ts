/**
 * Layout-aware plain text from PDF.js getTextContent() items.
 * Does not preserve semantic tables, multi-column order, or rotation—only
 * readable lines and rough paragraph breaks vs. a single wall of text.
 */

export type LayoutPdfTextOptions = {
  /** Multiplier on median glyph height for "same line" clustering (default 0.45). */
  lineTolFactor?: number;
  /** Vertical gap between lines > this × median height inserts a blank line (default 1.75). */
  paraGapFactor?: number;
  /** Min horizontal gap between runs (as × median height) to insert a space (default 0.12). */
  gapSpaceFactor?: number;
};

type PdfTextRun = {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hasEOL: boolean;
};

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function isTextItem(item: unknown): item is {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
} {
  if (typeof item !== "object" || item === null) return false;
  const o = item as Record<string, unknown>;
  if (typeof o.str !== "string") return false;
  if (!Array.isArray(o.transform) || o.transform.length < 6) return false;
  return true;
}

function runsFromItems(items: unknown[]): PdfTextRun[] {
  const out: PdfTextRun[] = [];
  for (const item of items) {
    if (!isTextItem(item)) continue;
    const str = item.str;
    if (!str) continue;

    const x = Number(item.transform[4]);
    const y = Number(item.transform[5]);
    let w = typeof item.width === "number" && item.width > 0 ? item.width : 0;
    let h = typeof item.height === "number" && item.height > 0 ? item.height : 0;

    if (h <= 0) {
      const scale = Math.hypot(
        Number(item.transform[0]),
        Number(item.transform[1])
      );
      h = scale > 0.01 ? scale * 12 : 12;
    }
    if (w <= 0) {
      w = Math.max(str.length * h * 0.45, h * 0.35);
    }

    out.push({
      str,
      x,
      y,
      w,
      h,
      hasEOL: item.hasEOL === true,
    });
  }
  return out;
}

type LineChunk = { text: string; y: number };

function buildLineChunks(
  lineParts: PdfTextRun[],
  medianH: number,
  gapSpaceFactor: number
): LineChunk[] {
  const yMean = lineParts.reduce((s, p) => s + p.y, 0) / lineParts.length;
  const parts = [...lineParts].sort((a, b) => a.x - b.x);
  const gapThreshold = Math.max(medianH * gapSpaceFactor, 1);

  const chunks: LineChunk[] = [];
  let out = "";
  let lastEndX = -Infinity;

  const flush = () => {
    const t = out.trimEnd();
    if (t) chunks.push({ text: t, y: yMean });
    out = "";
    lastEndX = -Infinity;
  };

  for (const part of parts) {
    if (out && part.x - lastEndX > gapThreshold) {
      out += part.x - lastEndX > gapThreshold * 4 ? "  " : " ";
    }
    out += part.str;
    lastEndX = Math.max(lastEndX, part.x + part.w);

    if (part.hasEOL) {
      flush();
    }
  }
  flush();

  return chunks;
}

/**
 * Convert raw PDF.js text content items to multi-line plain text for one page.
 */
export function layoutPdfTextItems(
  items: unknown[],
  options: LayoutPdfTextOptions = {}
): string {
  const lineTolFactor = options.lineTolFactor ?? 0.45;
  const paraGapFactor = options.paraGapFactor ?? 1.75;
  const gapSpaceFactor = options.gapSpaceFactor ?? 0.12;

  const raw = runsFromItems(items);
  if (raw.length === 0) return "";

  const heights = [...raw.map(r => r.h)].sort((a, b) => a - b);
  const medianH = Math.max(median(heights), 4);
  const lineTol = Math.max(medianH * lineTolFactor, 2);

  const sorted = [...raw].sort((a, b) => {
    if (Math.abs(a.y - b.y) > lineTol) return b.y - a.y;
    return a.x - b.x;
  });

  const lineGroups: PdfTextRun[][] = [];
  let current: PdfTextRun[] = [];

  for (const item of sorted) {
    if (current.length === 0) {
      current.push(item);
    } else if (Math.abs(item.y - current[0]!.y) <= lineTol) {
      current.push(item);
    } else {
      lineGroups.push(current);
      current = [item];
    }
  }
  if (current.length) lineGroups.push(current);

  lineGroups.sort((a, b) => {
    const ya = a.reduce((s, p) => s + p.y, 0) / a.length;
    const yb = b.reduce((s, p) => s + p.y, 0) / b.length;
    return yb - ya;
  });

  const built: LineChunk[] = [];
  for (const group of lineGroups) {
    built.push(...buildLineChunks(group, medianH, gapSpaceFactor));
  }

  built.sort((a, b) => b.y - a.y);

  const paraThreshold = medianH * paraGapFactor;
  const parts: string[] = [];

  for (let i = 0; i < built.length; i++) {
    const line = built[i]!;
    if (i > 0) {
      const prev = built[i - 1]!;
      const dy = prev.y - line.y;
      if (dy > paraThreshold) {
        parts.push("", line.text);
      } else {
        parts.push(line.text);
      }
    } else {
      parts.push(line.text);
    }
  }

  return parts.join("\n").trim();
}
