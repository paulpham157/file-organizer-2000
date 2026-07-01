import {
  appendYouTubeContextBlock,
  buildYouTubeContextBlock,
  extractYouTubeVideoId,
  getOriginalContent,
  isPendingYouTubeFormat,
  isYoutubeVideoTemplate,
  stripYouTubeContextBlock,
  stripYouTubeContextFromFormattedNote,
  YOUTUBE_FULL_TRANSCRIPT_HEADER,
  YOUTUBE_VIDEO_INFORMATION_HEADER,
} from "./youtube-context";

describe("youtube-context helpers", () => {
  const sampleContent = {
    videoId: "abc123",
    title: "Test Video",
    transcript: "Hello world transcript",
    channel: "Test Channel",
    datePublished: "2024-01-15",
  };

  it("extracts YouTube video IDs from common URL formats", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/watch?v=abc123")
    ).toBe("abc123");
    expect(
      extractYouTubeVideoId(
        "https://www.youtube.com/watch?t=120&v=abc123&feature=share"
      )
    ).toBe("abc123");
    expect(extractYouTubeVideoId("https://youtu.be/xyz_9")).toBe("xyz_9");
    expect(
      extractYouTubeVideoId("https://www.youtube.com/shorts/short1")
    ).toBe("short1");
    expect(
      extractYouTubeVideoId("https://www.youtube.com/embed/embed1")
    ).toBe("embed1");
    expect(extractYouTubeVideoId("not a youtube url")).toBeNull();
  });

  it("identifies youtube_video templates", () => {
    expect(isYoutubeVideoTemplate("youtube_video")).toBe(true);
    expect(isYoutubeVideoTemplate("youtube_video.md")).toBe(true);
    expect(isYoutubeVideoTemplate("meeting_note")).toBe(false);
  });

  it("detects bare YouTube links pending youtube_video formatting", () => {
    expect(isPendingYouTubeFormat("https://youtu.be/abc123")).toBe(true);
    expect(
      isPendingYouTubeFormat(`---
title: "Test"
tags: ["youtube"]
---

![](https://www.youtube.com/watch?v=abc123)

## Channel

Test Channel`)
    ).toBe(false);
    expect(isPendingYouTubeFormat("Regular note without a video")).toBe(false);
  });

  it("builds a structured YouTube context block", () => {
    const block = buildYouTubeContextBlock(sampleContent);
    expect(block).toContain(YOUTUBE_VIDEO_INFORMATION_HEADER);
    expect(block).toContain("Title: Test Video");
    expect(block).toContain("Video ID: abc123");
    expect(block).toContain("Channel: Test Channel");
    expect(block).toContain("Date Published: 2024-01-15");
    expect(block).toContain(YOUTUBE_FULL_TRANSCRIPT_HEADER);
    expect(block).toContain("Hello world transcript");
  });

  it("appends context block after original note content", () => {
    const result = appendYouTubeContextBlock(
      "https://youtu.be/abc123",
      sampleContent
    );
    expect(result.startsWith("https://youtu.be/abc123")).toBe(true);
    expect(result).toContain(YOUTUBE_FULL_TRANSCRIPT_HEADER);
  });

  it("strips structured and legacy YouTube context blocks", () => {
    const structured = appendYouTubeContextBlock(
      "https://youtu.be/abc123",
      sampleContent
    );
    expect(stripYouTubeContextBlock(structured)).toBe("https://youtu.be/abc123");
    expect(getOriginalContent(structured)).toBe("https://youtu.be/abc123");

    const legacy =
      "https://youtu.be/abc123\n\n## YouTube Video: Old Title\n\n### Transcript\n\nold text";
    expect(getOriginalContent(legacy)).toBe("https://youtu.be/abc123");
  });

  it("strips transcript sections from formatted output", () => {
    const formatted = `---
title: "Test"
---

![](https://www.youtube.com/watch?v=abc123)

## Detailed Summary

- Point one

${YOUTUBE_FULL_TRANSCRIPT_HEADER}

raw transcript should not remain`;

    expect(stripYouTubeContextFromFormattedNote(formatted)).not.toContain(
      "raw transcript should not remain"
    );
    expect(stripYouTubeContextFromFormattedNote(formatted)).toContain(
      "Point one"
    );
  });
});
