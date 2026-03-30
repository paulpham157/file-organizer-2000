import { layoutPdfTextItems } from "./pdf-text-layout";

/** Minimal PDF.js text item (user space). */
function item(
  str: string,
  x: number,
  y: number,
  opts: { w?: number; h?: number; hasEOL?: boolean } = {}
) {
  const h = opts.h ?? 12;
  return {
    str,
    transform: [h / 12, 0, 0, h / 12, x, y],
    width: opts.w ?? Math.max(str.length * h * 0.45, h * 0.35),
    height: h,
    ...(opts.hasEOL !== undefined ? { hasEOL: opts.hasEOL } : {}),
  };
}

describe("layoutPdfTextItems", () => {
  it("returns empty string for empty input", () => {
    expect(layoutPdfTextItems([])).toBe("");
  });

  it("ignores non-text items (marked content) without throwing", () => {
    const items = [
      { type: "beginMarkedContent", id: "mc0" },
      item("Kept", 10, 100),
      { foo: "bar" },
    ];
    expect(layoutPdfTextItems(items)).toBe("Kept");
  });

  it("places runs on different baselines on separate lines", () => {
    const items = [item("Top", 72, 720), item("Bottom", 72, 680)];
    const out = layoutPdfTextItems(items);
    expect(out).toContain("Top");
    expect(out).toContain("Bottom");
    expect(out.split("\n").length).toBeGreaterThanOrEqual(2);
    expect(out.indexOf("Top")).toBeLessThan(out.indexOf("Bottom"));
  });

  it("inserts space between runs on same line with large horizontal gap", () => {
    const items = [
      item("Hello", 72, 700, { w: 28 }),
      item("World", 200, 700, { w: 35 }),
    ];
    const out = layoutPdfTextItems(items);
    expect(out).toMatch(/Hello\s+World/);
  });

  it("inserts paragraph break when vertical gap between lines is large", () => {
    const items = [item("Title", 72, 750), item("Body", 72, 650)];
    const out = layoutPdfTextItems(items);
    expect(out).toContain("\n\n");
    expect(out.indexOf("Title")).toBeLessThan(out.indexOf("Body"));
  });

  it("uses single newline between adjacent lines (no extra blank line)", () => {
    const items = [item("A", 72, 700), item("B", 72, 688)];
    const out = layoutPdfTextItems(items);
    expect(out).toBe("A\nB");
  });

  it("splits output at hasEOL boundaries", () => {
    const items = [
      item("First", 72, 700, { hasEOL: true }),
      item("Second", 72, 700),
    ];
    const out = layoutPdfTextItems(items);
    expect(out).toContain("First");
    expect(out).toContain("Second");
    const lines = out.split("\n");
    expect(lines.some(l => l.includes("First"))).toBe(true);
    expect(lines.some(l => l.includes("Second"))).toBe(true);
  });
});
