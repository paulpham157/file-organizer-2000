import {
  capJsonStringified,
  capToolResultString,
  truncateStringForToolResult,
} from "./truncate-tool-result";

describe("truncateStringForToolResult", () => {
  it("returns unchanged when under limit", () => {
    const r = truncateStringForToolResult("abc", 10);
    expect(r).toEqual({ text: "abc", truncated: false });
  });

  it("never exceeds max when budget is smaller than marker", () => {
    const r = truncateStringForToolResult("hello world", 8);
    expect(r.truncated).toBe(true);
    expect(r.text).toBe("hello wo");
    expect(r.text.length).toBe(8);
  });

  it("uses marker suffix when budget fits marker", () => {
    const max = 36;
    const r = truncateStringForToolResult("x".repeat(200), max);
    expect(r.truncated).toBe(true);
    expect(r.text.endsWith("[...truncated]")).toBe(true);
    expect(r.text.length).toBe(max);
  });
});

describe("capJsonStringified", () => {
  it("returns compact JSON when small", () => {
    expect(capJsonStringified({ a: 1 }, 100)).toBe('{"a":1}');
  });

  it("wraps huge payload in valid JSON", () => {
    const huge = { x: "y".repeat(5000) };
    const s = capJsonStringified(huge, 300);
    const p = JSON.parse(s);
    expect(p.truncated).toBe(true);
    expect(p.originalLength).toBeGreaterThan(300);
    expect(typeof p.preview).toBe("string");
  });
});

describe("capToolResultString", () => {
  it("truncates non-JSON as string", () => {
    const long = "z".repeat(100);
    const out = capToolResultString(long, 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.includes("truncated")).toBe(true);
  });

  it("re-wraps oversized JSON string", () => {
    const obj = { data: "x".repeat(2000) };
    const str = JSON.stringify(obj);
    const out = capToolResultString(str, 200);
    const p = JSON.parse(out);
    expect(p.truncated).toBe(true);
  });
});
