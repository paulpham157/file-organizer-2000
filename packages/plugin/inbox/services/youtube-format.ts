import { type App, type TFile } from "obsidian";
import { logger } from "../../services/logger";
import FileOrganizer from "../../index";
import {
  appendYouTubeContextBlock,
  enhanceYouTubeFormattedNote,
  extractYouTubeVideoId,
  getOriginalContent,
  isYoutubeTemplate,
  type YouTubeFetchedContent,
} from "./youtube-context";
import { getYouTubeContent } from "./youtube-service";

export interface PrepareYouTubeFormatContentResult {
  formatContent: string;
  videoId: string | null;
  videoTitle: string | null;
  youtubeContent: YouTubeFetchedContent | null;
  /** Transcript fetch disabled (e.g. inbox setting). */
  transcriptFetchSkipped?: boolean;
  /** Transcript unavailable after fetch or a prior failed attempt. */
  transcriptFetchFailed?: boolean;
}

/** Inbox: skip youtube_* formatting when auto-fetch is disabled. */
export function shouldSkipYoutubeInboxFormatting(
  documentType: string,
  enableTranscriptFetching: boolean
): boolean {
  return isYoutubeTemplate(documentType) && !enableTranscriptFetching;
}

/** Inbox: skip formatting when a youtube URL has no transcript after prep. */
export function getYoutubeInboxFormatSkipReasonAfterPrep(
  documentType: string,
  prep: Pick<
    PrepareYouTubeFormatContentResult,
    "videoId" | "youtubeContent" | "transcriptFetchFailed"
  >
): string | null {
  if (!isYoutubeTemplate(documentType) || !prep.videoId || prep.youtubeContent) {
    return null;
  }
  return prep.transcriptFetchFailed
    ? "Could not fetch YouTube transcript"
    : "YouTube transcript unavailable";
}

export async function prepareYouTubeFormatContent(
  plugin: FileOrganizer,
  options: {
    baseContent: string;
    templateName: string;
    existingYoutubeContent?: YouTubeFetchedContent;
    /** When false, never fetch a transcript. Defaults to true. */
    enableTranscriptFetching?: boolean;
    /** When true, skip fetch because an earlier step already failed. */
    transcriptFetchAlreadyFailed?: boolean;
  }
): Promise<PrepareYouTubeFormatContentResult> {
  const enableTranscriptFetching = options.enableTranscriptFetching ?? true;
  const original = getOriginalContent(options.baseContent);
  let formatContent = original;
  let videoId: string | null = null;
  let videoTitle: string | null = null;
  let youtubeContent = options.existingYoutubeContent ?? null;

  if (!isYoutubeTemplate(options.templateName)) {
    return { formatContent, videoId, videoTitle, youtubeContent };
  }

  videoId = extractYouTubeVideoId(original);
  if (!videoId) {
    logger.info("No YouTube URL found in content for youtube_video formatting");
    return { formatContent, videoId, videoTitle, youtubeContent };
  }

  if (!youtubeContent) {
    if (!enableTranscriptFetching) {
      logger.info(
        "Skipping YouTube transcript fetch: enableYouTubeTranscriptFetching is off"
      );
      return {
        formatContent,
        videoId,
        videoTitle,
        youtubeContent: null,
        transcriptFetchSkipped: true,
      };
    }

    if (options.transcriptFetchAlreadyFailed) {
      logger.info(
        "Skipping YouTube transcript retry: fetch already failed in inbox pipeline"
      );
      return {
        formatContent,
        videoId,
        videoTitle: null,
        youtubeContent: null,
        transcriptFetchFailed: true,
      };
    }

    try {
      const fetched = await getYouTubeContent(videoId, plugin);
      videoTitle = fetched.title;
      youtubeContent = {
        videoId,
        title: fetched.title,
        transcript: fetched.transcript,
        channel: fetched.channel,
        channelUrl: fetched.channelUrl,
        datePublished: fetched.datePublished,
        segments: fetched.segments,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.warn(
        "Failed to fetch YouTube transcript, formatting without it:",
        errorMessage,
        error
      );
      return {
        formatContent,
        videoId,
        videoTitle: null,
        youtubeContent: null,
        transcriptFetchFailed: true,
      };
    }
  } else {
    videoTitle = youtubeContent.title;
  }

  formatContent = appendYouTubeContextBlock(original, youtubeContent);
  return { formatContent, videoId, videoTitle, youtubeContent };
}

export async function finalizeYouTubeFormattedNote(
  app: App,
  file: TFile,
  templateName: string,
  metadata?: Pick<YouTubeFetchedContent, "channel" | "channelUrl">
): Promise<string> {
  const formatted = await app.vault.read(file);
  if (!isYoutubeTemplate(templateName)) {
    return formatted;
  }

  const cleaned = enhanceYouTubeFormattedNote(formatted, metadata);
  if (cleaned !== formatted) {
    await app.vault.modify(file, cleaned);
  }
  return cleaned;
}
