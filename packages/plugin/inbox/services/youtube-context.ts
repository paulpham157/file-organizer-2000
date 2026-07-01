// Regex patterns for YouTube URL formats
const YOUTUBE_URL_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]+)/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]+)/,
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

export interface TranscriptSegment {
  text: string;
  /** Start time in seconds */
  offset: number;
}

export interface YouTubeFetchedContent {
  videoId: string;
  title: string;
  transcript: string;
  channel?: string;
  channelUrl?: string;
  datePublished?: string;
  segments?: TranscriptSegment[];
}

/** Formats seconds as MM:SS or H:MM:SS for timestamps in notes. */
export function formatTranscriptTimestamp(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) {
    return `${h}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/** Caption start times from youtube-transcript-plus are seconds (float). */
export function normalizeTranscriptOffsetSeconds(offset: number): number {
  if (!Number.isFinite(offset) || offset < 0) {
    return 0;
  }
  return offset;
}

const DEFAULT_TRANSCRIPT_GROUP_SECONDS = 45;

/**
 * Groups caption segments into readable lines with [MM:SS] markers.
 * New line when the bucket exceeds groupIntervalSec (default 45s).
 */
export function formatTimedTranscript(
  segments: TranscriptSegment[],
  groupIntervalSec = DEFAULT_TRANSCRIPT_GROUP_SECONDS
): string {
  if (segments.length === 0) {
    return "";
  }

  const lines: string[] = [];
  let bucketStart = normalizeTranscriptOffsetSeconds(segments[0].offset);
  let bucketText: string[] = [];

  const flushBucket = () => {
    if (bucketText.length === 0) {
      return;
    }
    const text = bucketText.join(" ").replace(/\s+/g, " ").trim();
    if (text) {
      lines.push(`[${formatTranscriptTimestamp(bucketStart)}] ${text}`);
    }
    bucketText = [];
  };

  for (const segment of segments) {
    const offsetSec = normalizeTranscriptOffsetSeconds(segment.offset);
    const text = segment.text.replace(/\s+/g, " ").trim();
    if (!text) {
      continue;
    }

    if (
      bucketText.length > 0 &&
      offsetSec - bucketStart >= groupIntervalSec
    ) {
      flushBucket();
      bucketStart = offsetSec;
    }

    if (bucketText.length === 0) {
      bucketStart = offsetSec;
    }

    bucketText.push(text);
  }

  flushBucket();
  return lines.join("\n");
}

export const YOUTUBE_VIDEO_INFORMATION_HEADER = "## YouTube Video Information";
export const YOUTUBE_FULL_TRANSCRIPT_HEADER = "## Full Transcript";

/** True for default and custom templates named youtube_*.md */
export function isYoutubeTemplate(templateName: string): boolean {
  const normalized = templateName.replace(/\.md$/i, "").toLowerCase();
  return normalized.startsWith("youtube_");
}

/** @deprecated Alias for isYoutubeTemplate */
export function isYoutubeVideoTemplate(templateName: string): boolean {
  return isYoutubeTemplate(templateName);
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
    ...(content.channelUrl ? [`Channel URL: ${content.channelUrl}`] : []),
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

/** Parses [MM:SS] or [H:MM:SS] bracket timestamps to total seconds. */
export function parseBracketTimestampToSeconds(timestamp: string): number | null {
  const match = timestamp.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
  const minutes = Number.parseInt(match[2], 10);
  const seconds = Number.parseInt(match[3], 10);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    minutes > 59 ||
    seconds > 59
  ) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

export function buildYouTubeWatchUrlWithTimestamp(
  videoId: string,
  totalSeconds: number
): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
}

const BRACKET_TIMESTAMP_PATTERN =
  /(?<!\])\[(?:(\d+):)?(\d{1,2}):(\d{2})\](?!\()/g;

/** Converts bare [MM:SS] / [H:MM:SS] markers into YouTube deep links. */
export function linkifyYouTubeTimestamps(
  content: string,
  videoId: string
): string {
  if (!videoId.trim()) {
    return content;
  }

  return content.replace(
    BRACKET_TIMESTAMP_PATTERN,
    (match, hours: string | undefined, minutes: string, seconds: string) => {
      const label = match.slice(1, -1);
      const totalSeconds = parseBracketTimestampToSeconds(
        `${hours ? `${hours}:` : ""}${minutes}:${seconds}`
      );
      if (totalSeconds === null) {
        return match;
      }
      const url = buildYouTubeWatchUrlWithTimestamp(videoId, totalSeconds);
      return `[${label}](${url})`;
    }
  );
}

function readFrontmatterField(
  frontmatter: string,
  field: string
): string | undefined {
  const pattern = new RegExp(
    `^${field}:\\s*(?:"([^"]*)"|'([^']*)'|([^\\n#]+))\\s*$`,
    "im"
  );
  const match = frontmatter.match(pattern);
  if (!match) {
    return undefined;
  }
  return (match[1] ?? match[2] ?? match[3] ?? "").trim();
}

function upsertFrontmatterField(
  content: string,
  field: string,
  value: string
): string {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return content;
  }

  const frontmatter = frontmatterMatch[1];
  const quotedValue = JSON.stringify(value);
  const fieldPattern = new RegExp(`^${field}:.*$`, "m");
  const nextFrontmatter = fieldPattern.test(frontmatter)
    ? frontmatter.replace(fieldPattern, `${field}: ${quotedValue}`)
    : `${frontmatter.trimEnd()}\n${field}: ${quotedValue}`;

  return content.replace(
    /^---\n[\s\S]*?\n---/,
    `---\n${nextFrontmatter}\n---`
  );
}

export function ensureYouTubeFrontmatterFields(
  content: string,
  metadata?: Pick<YouTubeFetchedContent, "channel" | "channelUrl">
): string {
  if (!metadata) {
    return content;
  }

  let next = content;
  const frontmatterMatch = next.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return next;
  }

  const frontmatter = frontmatterMatch[1];
  if (metadata.channel && !readFrontmatterField(frontmatter, "channel")) {
    next = upsertFrontmatterField(next, "channel", metadata.channel);
  }
  if (
    metadata.channelUrl &&
    !readFrontmatterField(frontmatter, "channel_url")
  ) {
    next = upsertFrontmatterField(next, "channel_url", metadata.channelUrl);
  }

  return next;
}

/** Wraps plain-text ## Channel lines in a markdown link when channel_url exists. */
export function linkifyYouTubeChannelSection(content: string): string {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return content;
  }

  const channelUrl = readFrontmatterField(frontmatterMatch[1], "channel_url");
  if (!channelUrl) {
    return content;
  }

  const channel = readFrontmatterField(frontmatterMatch[1], "channel");

  return content.replace(
    /(## Channel\s*\n\n)(?!\[)([^\n]+)(?=\n)/,
    (_match, heading: string, line: string) => {
      const text = line.trim();
      if (!text) {
        return `${heading}${line}`;
      }
      const label = channel || text;
      return `${heading}[${label}](${channelUrl})`;
    }
  );
}

/** Strips transcript context, then linkifies channel and timestamps when possible. */
export function enhanceYouTubeFormattedNote(
  content: string,
  metadata?: Pick<YouTubeFetchedContent, "channel" | "channelUrl">
): string {
  let enhanced = stripYouTubeContextFromFormattedNote(content);
  enhanced = ensureYouTubeFrontmatterFields(enhanced, metadata);
  enhanced = linkifyYouTubeChannelSection(enhanced);

  const videoId = extractYouTubeVideoId(enhanced);
  if (videoId) {
    enhanced = linkifyYouTubeTimestamps(enhanced, videoId);
  }

  return enhanced;
}

export function getOriginalContent(content: string): string {
  let original = stripYouTubeContextBlock(content);

  const audioLinkPattern = /^!\[\[[^\]]+\]\]\s*\n\n/;
  const transcriptHeaderPattern = /^## Transcript for [^\n]+\n\n/;

  original = original.replace(audioLinkPattern, "");
  original = original.replace(transcriptHeaderPattern, "");

  return original;
}
