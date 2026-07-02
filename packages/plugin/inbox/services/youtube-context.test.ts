import {
  appendYouTubeContextBlock,
  buildYouTubeContextBlock,
  buildYouTubeWatchUrlWithTimestamp,
  enhanceYouTubeFormattedNote,
  extractYouTubeVideoId,
  formatTimedTranscript,
  formatTranscriptTimestamp,
  getAdaptiveTranscriptGroupInterval,
  getOriginalContent,
  getVideoDurationFromSegments,
  isPendingYouTubeFormat,
  isYoutubeTemplate,
  isYoutubeVideoTemplate,
  linkifyYouTubeChannelSection,
  linkifyYouTubeTimestamps,
  parseBracketTimestampToSeconds,
  prepareTranscriptForFormatting,
  sampleTranscriptSegments,
  stripYouTubeContextBlock,
  stripYouTubeContextFromFormattedNote,
  TRANSCRIPT_TRUNCATION_NOTICE,
  YOUTUBE_FULL_TRANSCRIPT_HEADER,
  YOUTUBE_VIDEO_INFORMATION_HEADER,
  type TranscriptSegment,
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
    expect(
      extractYouTubeVideoId("https://www.youtube.com/live/dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
    expect(
      extractYouTubeVideoId("https://www.youtube.com/v/dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeVideoId("not a youtube url")).toBeNull();
  });

  it("identifies youtube_* templates", () => {
    expect(isYoutubeTemplate("youtube_video")).toBe(true);
    expect(isYoutubeTemplate("youtube_video.md")).toBe(true);
    expect(isYoutubeTemplate("youtube_summary")).toBe(true);
    expect(isYoutubeTemplate("youtube_timestamped_outline.md")).toBe(true);
    expect(isYoutubeTemplate("youtube_custom")).toBe(true);
    expect(isYoutubeTemplate("meeting_note")).toBe(false);
    expect(isYoutubeVideoTemplate("youtube_qa")).toBe(true);
  });

  it("formats transcript timestamps", () => {
    expect(formatTranscriptTimestamp(0)).toBe("00:00");
    expect(formatTranscriptTimestamp(65)).toBe("01:05");
    expect(formatTranscriptTimestamp(3661)).toBe("1:01:01");
  });

  it("groups segments into timed transcript lines", () => {
    const segments: TranscriptSegment[] = [
      { text: "Intro", offset: 0 },
      { text: "setup", offset: 12 },
      { text: "Main topic", offset: 50 },
      { text: "continued", offset: 55 },
    ];

    const timed = formatTimedTranscript(segments, 45);
    expect(timed).toBe(
      "[00:00] Intro setup\n[00:50] Main topic continued"
    );
  });

  it("uses adaptive grouping intervals by video duration", () => {
    expect(getAdaptiveTranscriptGroupInterval(1800)).toBe(45);
    expect(getAdaptiveTranscriptGroupInterval(3600)).toBe(45);
    expect(getAdaptiveTranscriptGroupInterval(3601)).toBe(90);
    expect(getAdaptiveTranscriptGroupInterval(7200)).toBe(90);
    expect(getAdaptiveTranscriptGroupInterval(7201)).toBe(120);
  });

  it("samples intro, middle, and ending segments", () => {
    const segments: TranscriptSegment[] = [
      { text: "intro", offset: 30 },
      { text: "middle", offset: 5400 },
      { text: "ending", offset: 7100 },
    ];

    expect(getVideoDurationFromSegments(segments)).toBe(7100);
    const sampled = sampleTranscriptSegments(segments, 2);
    expect(sampled.map(segment => segment.text)).toEqual([
      "intro",
      "middle",
      "ending",
    ]);
  });

  it("samples transcript when formatting budget is exceeded", () => {
    const segments: TranscriptSegment[] = Array.from({ length: 200 }, (_, i) => ({
      text: `word-${i} `.repeat(20),
      offset: i * 60,
    }));

    const result = prepareTranscriptForFormatting(segments, {
      maxFormattingTokens: 2000,
      originalContent: "https://youtu.be/abc123",
      youtubeMetadata: {
        videoId: "abc123",
        title: "Long Video",
        channel: "Channel",
      },
      countTokens: text => Math.ceil(text.length / 4),
    });

    expect(result.truncated).toBe(true);
    expect(result.transcript.length).toBeLessThan(
      formatTimedTranscript(segments, result.groupIntervalSec).length
    );
    const block = buildYouTubeContextBlock({
      videoId: "abc123",
      title: "Long Video",
      channel: "Channel",
      transcript: result.transcript,
      truncationNotice: TRANSCRIPT_TRUNCATION_NOTICE,
    });
    expect(block).toContain(TRANSCRIPT_TRUNCATION_NOTICE);
  });

  it("hard caps transcript when sampling and grouping still exceed budget", () => {
    const segments: TranscriptSegment[] = Array.from({ length: 80 }, (_, i) => ({
      text: `segment-${i} `.repeat(40),
      offset: i * 60,
    }));

    const maxFormattingTokens = 500;
    const countTokens = (text: string) => Math.ceil(text.length / 4);
    const originalContent = "https://youtu.be/abc123";
    const youtubeMetadata = {
      videoId: "abc123",
      title: "Long Video",
      channel: "Channel",
    };

    const result = prepareTranscriptForFormatting(segments, {
      maxFormattingTokens,
      originalContent,
      youtubeMetadata,
      countTokens,
    });

    expect(result.truncated).toBe(true);
    const block = appendYouTubeContextBlock(originalContent, {
      ...youtubeMetadata,
      transcript: result.transcript,
      truncationNotice: TRANSCRIPT_TRUNCATION_NOTICE,
    });
    expect(countTokens(block)).toBeLessThanOrEqual(
      Math.floor(maxFormattingTokens * 0.8)
    );
  });

  it("includes timed transcript in context block when provided", () => {
    const block = buildYouTubeContextBlock({
      ...sampleContent,
      transcript: "[00:00] Hello world transcript",
    });
    expect(block).toContain("[00:00] Hello world transcript");
  });

  it("detects bare YouTube links pending youtube formatting", () => {
    expect(isPendingYouTubeFormat("https://youtu.be/abc123")).toBe(true);
    expect(
      isPendingYouTubeFormat("https://www.youtube.com/live/dQw4w9WgXcQ")
    ).toBe(true);
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
    const block = buildYouTubeContextBlock({
      ...sampleContent,
      channelUrl: "https://www.youtube.com/@test-channel",
    });
    expect(block).toContain(YOUTUBE_VIDEO_INFORMATION_HEADER);
    expect(block).toContain("Title: Test Video");
    expect(block).toContain("Video ID: abc123");
    expect(block).toContain("Channel: Test Channel");
    expect(block).toContain(
      "Channel URL: https://www.youtube.com/@test-channel"
    );
    expect(block).toContain("Date Published: 2024-01-15");
    expect(block).toContain(YOUTUBE_FULL_TRANSCRIPT_HEADER);
    expect(block).toContain("Hello world transcript");
  });

  it("parses bracket timestamps to seconds", () => {
    expect(parseBracketTimestampToSeconds("02:14")).toBe(134);
    expect(parseBracketTimestampToSeconds("1:01:01")).toBe(3661);
    expect(parseBracketTimestampToSeconds("invalid")).toBeNull();
  });

  it("builds YouTube watch URLs with timestamp parameters", () => {
    expect(buildYouTubeWatchUrlWithTimestamp("abc123", 134)).toBe(
      "https://www.youtube.com/watch?v=abc123&t=134s"
    );
  });

  it("linkifies bare bracket timestamps", () => {
    const input = "- [02:14] Intro\n- [1:01:01] Deep dive";
    const linked = linkifyYouTubeTimestamps(input, "abc123");
    expect(linked).toContain(
      "[02:14](https://www.youtube.com/watch?v=abc123&t=134s)"
    );
    expect(linked).toContain(
      "[1:01:01](https://www.youtube.com/watch?v=abc123&t=3661s)"
    );
  });

  it("does not double-link timestamps", () => {
    const alreadyLinked =
      "- [02:14](https://www.youtube.com/watch?v=abc123&t=134s) Intro";
    expect(linkifyYouTubeTimestamps(alreadyLinked, "abc123")).toBe(
      alreadyLinked
    );
  });

  it("linkifies the channel section when channel_url is present", () => {
    const note = `---
title: "Test"
channel: "Test Channel"
channel_url: "https://www.youtube.com/@test-channel"
---

## Channel

Test Channel

## Summary

- Point`;
    expect(linkifyYouTubeChannelSection(note)).toContain(
      "[Test Channel](https://www.youtube.com/@test-channel)"
    );
  });

  it("linkifies the channel section with a single newline after the heading", () => {
    const note = `---
title: "Test"
channel: "Jaryd Krause - Buying Online Businesses"
channel_url: https://www.youtube.com/@buyingonlinebusinesses
---

## Channel
Jaryd Krause - Buying Online Businesses

## Summary

- Point`;
    expect(linkifyYouTubeChannelSection(note)).toContain(
      "[Jaryd Krause - Buying Online Businesses](https://www.youtube.com/@buyingonlinebusinesses)"
    );
  });

  it("enhances formatted notes with channel links and timestamps", () => {
    const formatted = `---
title: "Test"
channel: "Test Channel"
---

![](https://www.youtube.com/watch?v=abc123)

## Channel

Test Channel

## Detailed Summary

- [02:14] Intro point`;

    const enhanced = enhanceYouTubeFormattedNote(formatted, {
      channel: "Test Channel",
      channelUrl: "https://www.youtube.com/@test-channel",
    });

    expect(enhanced).toContain('channel_url: "https://www.youtube.com/@test-channel"');
    expect(enhanced).toContain(
      "[Test Channel](https://www.youtube.com/@test-channel)"
    );
    expect(enhanced).toContain(
      "[02:14](https://www.youtube.com/watch?v=abc123&t=134s)"
    );
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
