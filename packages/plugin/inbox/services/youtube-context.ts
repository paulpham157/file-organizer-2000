// Regex patterns for YouTube URL formats
const YOUTUBE_URL_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|music\.youtube\.com)\/watch\?[^#\s]*(?:&|\?)v=([a-zA-Z0-9_-]+)/,
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|music\.youtube\.com)\/[^\s]*[?&]v=([a-zA-Z0-9_-]+)/,
];

export function extractYouTubeVideoId(content: string): string | null {
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

export interface YouTubeFetchedContent {
  videoId: string;
  title: string;
  transcript: string;
  channel?: string;
  datePublished?: string;
}

export const YOUTUBE_VIDEO_INFORMATION_HEADER = "## YouTube Video Information";
export const YOUTUBE_FULL_TRANSCRIPT_HEADER = "## Full Transcript";

export function isYoutubeVideoTemplate(templateName: string): boolean {
  const normalized = templateName.replace(/\.md$/i, "").toLowerCase();
  return normalized === "youtube_video";
}

/** Bare YouTube link note — has a video URL but not yet formatted with the embed. */
export function isPendingYouTubeFormat(content: string): boolean {
  const original = getOriginalContent(content).trim();
  if (!original) {
    return false;
  }

  const videoId = extractYouTubeVideoId(original);
  if (!videoId) {
    return false;
  }

  return !content.includes(`![](https://www.youtube.com/watch?v=${videoId}`);
}

export function buildYouTubeContextBlock(
  content: YouTubeFetchedContent
): string {
  const infoLines = [
    YOUTUBE_VIDEO_INFORMATION_HEADER,
    "",
    `Title: ${content.title}`,
    `Video ID: ${content.videoId}`,
    ...(content.channel ? [`Channel: ${content.channel}`] : []),
    ...(content.datePublished
      ? [`Date Published: ${content.datePublished}`]
      : []),
    "",
    YOUTUBE_FULL_TRANSCRIPT_HEADER,
    "",
    content.transcript,
  ];
  return infoLines.join("\n");
}

export function appendYouTubeContextBlock(
  baseContent: string,
  youtubeContent: YouTubeFetchedContent
): string {
  const original = getOriginalContent(baseContent).trimEnd();
  const block = buildYouTubeContextBlock(youtubeContent);
  if (!original) {
    return block;
  }
  return `${original}\n\n${block}`;
}

/** Removes YouTube fetch/formatting context blocks from note content. */
export function stripYouTubeContextBlock(content: string): string {
  let stripped = content;

  const structuredIndex = stripped.indexOf(
    `\n\n${YOUTUBE_VIDEO_INFORMATION_HEADER}`
  );
  if (structuredIndex !== -1) {
    stripped = stripped.slice(0, structuredIndex);
  } else if (stripped.startsWith(`${YOUTUBE_VIDEO_INFORMATION_HEADER}\n`)) {
    stripped = "";
  }

  const legacyIndex = stripped.indexOf("\n\n## YouTube Video:");
  if (legacyIndex !== -1) {
    stripped = stripped.slice(0, legacyIndex);
  } else if (stripped.startsWith("## YouTube Video:")) {
    stripped = "";
  }

  return stripped;
}

/**
 * Removes raw transcript / metadata sections from formatted output if the model
 * included them despite instructions.
 */
export function stripYouTubeContextFromFormattedNote(content: string): string {
  let stripped = stripYouTubeContextBlock(content);

  const fullTranscriptOnly = stripped.indexOf(
    `\n\n${YOUTUBE_FULL_TRANSCRIPT_HEADER}`
  );
  if (fullTranscriptOnly !== -1) {
    stripped = stripped.slice(0, fullTranscriptOnly);
  } else if (stripped.startsWith(`${YOUTUBE_FULL_TRANSCRIPT_HEADER}\n`)) {
    stripped = "";
  }

  return stripped.trimEnd();
}

export function getOriginalContent(content: string): string {
  let original = stripYouTubeContextBlock(content);

  const audioLinkPattern = /^!\[\[[^\]]+\]\]\s*\n\n/;
  const transcriptHeaderPattern = /^## Transcript for [^\n]+\n\n/;

  original = original.replace(audioLinkPattern, "");
  original = original.replace(transcriptHeaderPattern, "");

  return original;
}
