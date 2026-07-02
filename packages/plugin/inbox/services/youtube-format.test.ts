import { type App, type TFile } from "obsidian";
import {
  YOUTUBE_FULL_TRANSCRIPT_HEADER,
  YOUTUBE_VIDEO_INFORMATION_HEADER,
} from "./youtube-context";
import {
  finalizeYouTubeFormattedNote,
  getYoutubeInboxFormatSkipReasonAfterPrep,
  prepareYouTubeFormatContent,
  shouldSkipYoutubeInboxFormatting,
} from "./youtube-format";

const mockGetYouTubeContent = jest.fn();

jest.mock("../../utils/token-counter", () => ({
  initializeTokenCounter: jest.fn().mockResolvedValue(undefined),
  getTokenCount: jest.fn((text: string) => Math.ceil(text.length / 4)),
  cleanup: jest.fn(),
}));

jest.mock("./youtube-service", () => ({
  getYouTubeContent: (...args: unknown[]) => mockGetYouTubeContent(...args),
}));

describe("youtube-format", () => {
  const plugin = {
    settings: { maxFormattingTokens: 100_000 },
  } as import("../../index").default;

  const existingYoutubeContent = {
    videoId: "abc123",
    title: "Cached Video",
    transcript: "[00:00] Cached transcript",
    channel: "Test Channel",
    channelUrl: "https://www.youtube.com/@test",
    datePublished: "2024-01-15",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("shouldSkipYoutubeInboxFormatting", () => {
    it("skips youtube_* templates when transcript fetching is disabled", () => {
      expect(
        shouldSkipYoutubeInboxFormatting("youtube_video", false)
      ).toBe(true);
      expect(
        shouldSkipYoutubeInboxFormatting("youtube_summary.md", false)
      ).toBe(true);
    });

    it("does not skip when fetching is enabled or template is not youtube_*", () => {
      expect(
        shouldSkipYoutubeInboxFormatting("youtube_video", true)
      ).toBe(false);
      expect(shouldSkipYoutubeInboxFormatting("meeting_note", false)).toBe(
        false
      );
    });
  });

  describe("getYoutubeInboxFormatSkipReasonAfterPrep", () => {
    it("returns null when transcript is available", () => {
      expect(
        getYoutubeInboxFormatSkipReasonAfterPrep("youtube_video", {
          videoId: "abc123",
          youtubeContent: existingYoutubeContent,
        })
      ).toBeNull();
    });

    it("returns fetch failure reason when prep failed", () => {
      expect(
        getYoutubeInboxFormatSkipReasonAfterPrep("youtube_video", {
          videoId: "abc123",
          youtubeContent: null,
          transcriptFetchFailed: true,
        })
      ).toBe("Could not fetch YouTube transcript");
    });

    it("returns generic reason when video id exists but content is missing", () => {
      expect(
        getYoutubeInboxFormatSkipReasonAfterPrep("youtube_qa", {
          videoId: "abc123",
          youtubeContent: null,
        })
      ).toBe("YouTube transcript unavailable");
    });

    it("returns null for non-youtube templates", () => {
      expect(
        getYoutubeInboxFormatSkipReasonAfterPrep("meeting_note", {
          videoId: "abc123",
          youtubeContent: null,
          transcriptFetchFailed: true,
        })
      ).toBeNull();
    });
  });

  describe("prepareYouTubeFormatContent", () => {
    it("passes through non-youtube templates unchanged", async () => {
      const result = await prepareYouTubeFormatContent(plugin, {
        baseContent: "Meeting notes",
        templateName: "meeting_note",
      });

      expect(result).toEqual({
        formatContent: "Meeting notes",
        videoId: null,
        videoTitle: null,
        youtubeContent: null,
      });
      expect(mockGetYouTubeContent).not.toHaveBeenCalled();
    });

    it("marks transcript fetch as skipped when disabled", async () => {
      const result = await prepareYouTubeFormatContent(plugin, {
        baseContent: "https://youtu.be/abc123",
        templateName: "youtube_video",
        enableTranscriptFetching: false,
      });

      expect(result.videoId).toBe("abc123");
      expect(result.youtubeContent).toBeNull();
      expect(result.transcriptFetchSkipped).toBe(true);
      expect(mockGetYouTubeContent).not.toHaveBeenCalled();
    });

    it("does not retry fetch when inbox step already failed", async () => {
      const result = await prepareYouTubeFormatContent(plugin, {
        baseContent: "https://youtu.be/abc123",
        templateName: "youtube_video",
        transcriptFetchAlreadyFailed: true,
      });

      expect(result.videoId).toBe("abc123");
      expect(result.youtubeContent).toBeNull();
      expect(result.transcriptFetchFailed).toBe(true);
      expect(mockGetYouTubeContent).not.toHaveBeenCalled();
    });

    it("reuses existing youtube content without fetching", async () => {
      const result = await prepareYouTubeFormatContent(plugin, {
        baseContent: "https://youtu.be/abc123",
        templateName: "youtube_video",
        existingYoutubeContent,
      });

      expect(result.videoTitle).toBe("Cached Video");
      expect(result.youtubeContent).toBe(existingYoutubeContent);
      expect(result.formatContent).toContain(YOUTUBE_VIDEO_INFORMATION_HEADER);
      expect(result.formatContent).toContain(YOUTUBE_FULL_TRANSCRIPT_HEADER);
      expect(result.formatContent).toContain("Cached transcript");
      expect(mockGetYouTubeContent).not.toHaveBeenCalled();
    });

    it("fetches transcript and appends context block on success", async () => {
      mockGetYouTubeContent.mockResolvedValueOnce({
        title: "Fetched Video",
        transcript: "[00:00] Live transcript",
        channel: "Channel",
        channelUrl: "https://www.youtube.com/@channel",
        datePublished: "2024-02-01",
        segments: [{ text: "Live transcript", offset: 0 }],
      });

      const result = await prepareYouTubeFormatContent(plugin, {
        baseContent: "https://www.youtube.com/watch?v=abc123",
        templateName: "youtube_summary",
      });

      expect(mockGetYouTubeContent).toHaveBeenCalledWith("abc123", plugin);
      expect(result.videoTitle).toBe("Fetched Video");
      expect(result.youtubeContent?.transcript).toBe("[00:00] Live transcript");
      expect(result.formatContent).toContain("Title: Fetched Video");
    });

    it("samples transcript when formatting budget is exceeded", async () => {
      const segments = Array.from({ length: 200 }, (_, i) => ({
        text: `segment-${i} `.repeat(30),
        offset: i * 60,
      }));

      mockGetYouTubeContent.mockResolvedValueOnce({
        title: "Long Video",
        transcript: "placeholder",
        segments,
      });

      const smallBudgetPlugin = {
        settings: { maxFormattingTokens: 2000 },
      } as import("../../index").default;

      const result = await prepareYouTubeFormatContent(smallBudgetPlugin, {
        baseContent: "https://www.youtube.com/watch?v=abc123",
        templateName: "youtube_summary",
      });

      expect(result.transcriptTruncated).toBe(true);
      expect(result.formatContent).toContain("Transcript was sampled");
      expect(result.youtubeContent?.transcript.length).toBeLessThan(
        segments.map(segment => segment.text).join(" ").length
      );
    });

    it("returns transcriptFetchFailed when fetch throws", async () => {
      mockGetYouTubeContent.mockRejectedValueOnce(new Error("Network error"));

      const result = await prepareYouTubeFormatContent(plugin, {
        baseContent: "https://youtu.be/abc123",
        templateName: "youtube_video",
      });

      expect(result.videoId).toBe("abc123");
      expect(result.youtubeContent).toBeNull();
      expect(result.transcriptFetchFailed).toBe(true);
      expect(result.formatContent).toBe("https://youtu.be/abc123");
    });
  });

  describe("finalizeYouTubeFormattedNote", () => {
    it("returns content unchanged for non-youtube templates", async () => {
      const read = jest.fn().mockResolvedValue("Plain note");
      const modify = jest.fn();
      const app = { vault: { read, modify } } as unknown as App;
      const file = { path: "note.md" } as TFile;

      const result = await finalizeYouTubeFormattedNote(
        app,
        file,
        "meeting_note"
      );

      expect(result).toBe("Plain note");
      expect(modify).not.toHaveBeenCalled();
    });

    it("modifies the vault when youtube post-processing changes content", async () => {
      const formatted = `---
title: "Test"
channel: "Test Channel"
channel_url: "https://www.youtube.com/@test-channel"
---

![](https://www.youtube.com/watch?v=abc123)

## Channel

Test Channel

## Summary

- [02:14] Intro point`;

      const read = jest.fn().mockResolvedValue(formatted);
      const modify = jest.fn().mockResolvedValue(undefined);
      const app = { vault: { read, modify } } as unknown as App;
      const file = { path: "note.md" } as TFile;

      const result = await finalizeYouTubeFormattedNote(
        app,
        file,
        "youtube_video",
        {
          channel: "Test Channel",
          channelUrl: "https://www.youtube.com/@test-channel",
        }
      );

      expect(modify).toHaveBeenCalledTimes(1);
      expect(modify.mock.calls[0][0]).toBe(file);
      expect(result).toContain(
        "[02:14](https://www.youtube.com/watch?v=abc123&t=134s)"
      );
      expect(result).toContain(
        "[Test Channel](https://www.youtube.com/@test-channel)"
      );
    });

    it("does not modify the vault when content is already clean", async () => {
      const alreadyClean = `---
title: "Test"
---

![](https://www.youtube.com/watch?v=abc123)

## Summary

Done.`;

      const read = jest.fn().mockResolvedValue(alreadyClean);
      const modify = jest.fn();
      const app = { vault: { read, modify } } as unknown as App;
      const file = { path: "note.md" } as TFile;

      const result = await finalizeYouTubeFormattedNote(
        app,
        file,
        "youtube_video"
      );

      expect(result).toBe(alreadyClean);
      expect(modify).not.toHaveBeenCalled();
    });
  });
});
