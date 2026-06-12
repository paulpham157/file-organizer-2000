import {
  MEETING_APP_NAMES,
  MEETING_URL_PATTERNS,
  MEETING_WINDOW_KEYWORDS,
} from "./meeting-predicate";

export type DetectionReason = "url" | "window" | "app";

export type ScreenpipeItemContent = {
  app_name?: string;
  window_name?: string;
  url?: string;
  browser_url?: string;
  text?: string;
  transcript?: string;
  transcription?: string;
  timestamp?: string;
};

export type ScreenpipeItem = {
  type?: string;
  timestamp?: string;
  time?: string;
  content?: ScreenpipeItemContent;
  /** Why this item was classified as meeting-like (for "Detected via" UI). */
  detectionReason?: DetectionReason | null;
};

export type MeetingProvider =
  | "Google Meet"
  | "Microsoft Teams"
  | "Zoom"
  | "Webex"
  | "Slack"
  | "Unknown";

export type MeetingSession = {
  key: string;
  provider: MeetingProvider;
  title: string;
  start: Date;
  end: Date;
  evidence: ScreenpipeItem[];
  audio: ScreenpipeItem[];
  transcript: string;
  detectedVia: DetectionReason;
};

const PATH_CAP_CHARS = 200;

export function parseItemTime(i: ScreenpipeItem): Date | null {
  const t = i.timestamp ?? i.time ?? i.content?.timestamp;
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Normalize URL to a stable meeting identity key. Does not over-normalize;
 * keeps distinct meetings separate (Meet code, Zoom id, Teams meetingId, etc.).
 */
export function normalizeUrl(u: string): string {
  const raw = u.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase();
    const path = url.pathname;
    const search = url.searchParams;

    if (host.includes("meet.google.com")) {
      return `${host}${path}`;
    }
    if (host.includes("zoom.us")) {
      const pathNorm = path.replace(/\/wc\//, "/").split("/").slice(0, 4).join("/");
      const pwd = search.get("pwd");
      return pwd ? `${host}${pathNorm}?pwd=${pwd}` : `${host}${pathNorm}`;
    }
    if (host.includes("teams.microsoft.com")) {
      const pathSegs = path.split("/").filter(Boolean).slice(0, 3).join("/");
      const meetingId = search.get("meetingId") ?? search.get("threadId") ?? search.get("callId");
      return meetingId
        ? `${host}/${pathSegs}?id=${meetingId}`
        : `${host}/${pathSegs}`;
    }
    if (host.includes("meet.webex.com") || host.includes("webex.com")) {
      return `${host}${path.split("/").slice(0, 4).join("/")}`;
    }
    if (host.includes("slack.com")) {
      return `${host}${path.split("/").slice(0, 4).join("/")}`;
    }
    const pathCapped = path.slice(0, PATH_CAP_CHARS);
    return `${host}${pathCapped}`;
  } catch {
    return raw.toLowerCase();
  }
}

export function normalizeWindowName(w?: string): string {
  if (!w) return "";
  return w
    .replace(/\s+-\s+google chrome$/i, "")
    .replace(/\s+-\s+microsoft edge$/i, "")
    .replace(/\s+-\s+brave$/i, "")
    .replace(/\s+-\s+firefox$/i, "")
    .trim()
    .toLowerCase();
}

export function inferProvider(
  urlRaw: string,
  windowName: string
): MeetingProvider {
  const u = urlRaw.toLowerCase();
  const w = windowName.toLowerCase();
  if (u.includes("meet.google.com") || w.includes("meet - ")) return "Google Meet";
  if (u.includes("teams.microsoft.com") || u.includes("teams.live.com") || w.includes("teams"))
    return "Microsoft Teams";
  if (u.includes("zoom.us") || w.includes("zoom meeting")) return "Zoom";
  if (u.includes("webex") || u.includes("meet.webex.com") || w.includes("webex"))
    return "Webex";
  if (u.includes("slack.com") || w.includes("slack")) return "Slack";
  return "Unknown";
}

export function meetingKeyFromContent(content: ScreenpipeItemContent | undefined): string {
  if (!content) return "unknown";
  const urlRaw = (content.browser_url ?? content.url ?? "").trim();
  if (urlRaw) return `url:${normalizeUrl(urlRaw)}`;
  const w = normalizeWindowName(content.window_name);
  if (w) return `win:${w}`;
  const app = (content.app_name ?? "").toLowerCase().trim();
  return app ? `app:${app}` : "unknown";
}

export type SessionBase = {
  key: string;
  start: Date;
  end: Date;
  evidence: ScreenpipeItem[];
};

/**
 * Group meeting hits into sessions by key. Uses a map of active sessions by key
 * so interleaved evidence (alt-tab, multi-meeting day) extends the correct session.
 */
export function groupMeetingSessions(
  hits: ScreenpipeItem[],
  gapMs: number = 5 * 60 * 1000
): SessionBase[] {
  const withTime = hits
    .map((h) => ({ h, t: parseItemTime(h) }))
    .filter((x): x is { h: ScreenpipeItem; t: Date } => x.t !== null)
    .sort((a, b) => a.t.getTime() - b.t.getTime());

  const byKey = new Map<string, SessionBase>();

  for (const { h, t } of withTime) {
    const key = meetingKeyFromContent(h.content);
    const existing = byKey.get(key);

    if (existing && t.getTime() - existing.end.getTime() <= gapMs) {
      existing.end = t;
      existing.evidence.push(h);
    } else {
      byKey.set(key, {
        key,
        start: t,
        end: t,
        evidence: [h],
      });
    }
  }

  return Array.from(byKey.values());
}

/** Strong = URL or window match. Weak = native meeting app only. */
function isStrongHit(content: ScreenpipeItemContent | undefined): boolean {
  if (!content) return false;
  const urlRaw = (content.browser_url ?? content.url ?? "").toLowerCase();
  if (MEETING_URL_PATTERNS.some((p) => urlRaw.includes(p))) return true;
  const window = (content.window_name ?? "").toLowerCase();
  if (MEETING_WINDOW_KEYWORDS.some((kw) => window.includes(kw))) return true;
  return false;
}

function isWeakHit(content: ScreenpipeItemContent | undefined): boolean {
  if (!content) return false;
  if (isStrongHit(content)) return false;
  const app = (content.app_name ?? "").toLowerCase().trim();
  return MEETING_APP_NAMES.has(app);
}

const WEAK_WINDOW_MS = 10 * 60 * 1000;
const MIN_SESSION_DURATION_MS = 2 * 60 * 1000;

/**
 * Session is valid if it spans at least 2 minutes AND has ≥1 strong hit
 * OR ≥3 weak hits within 10 minutes.
 */
export function isSessionValidByEvidence(session: SessionBase): boolean {
  const duration = session.end.getTime() - session.start.getTime();
  if (duration < MIN_SESSION_DURATION_MS) return false;

  const hasStrong = session.evidence.some((e) => isStrongHit(e.content));
  if (hasStrong) return true;

  const weak = session.evidence.filter((e) => isWeakHit(e.content));
  if (weak.length < 3) return false;

  const times = weak
    .map((e) => parseItemTime(e))
    .filter((t): t is Date => t !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  for (let i = 0; i <= times.length - 3; i++) {
    if (times[i + 2].getTime() - times[i].getTime() <= WEAK_WINDOW_MS) {
      return true;
    }
  }
  return false;
}

export function buildSessionTitle(evidence: ScreenpipeItem[]): {
  provider: MeetingProvider;
  title: string;
  detectedVia: DetectionReason;
} {
  const first = evidence[0]?.content ?? {};
  const urlRaw = (first.browser_url ?? first.url ?? "");
  const windowName = (first.window_name ?? "");
  const provider = inferProvider(urlRaw, windowName);

  let title =
    provider !== "Unknown" ? provider : (windowName || "Meeting");
  title = title.replace(
    /\s+-\s+(google chrome|microsoft edge|brave|firefox)$/i,
    ""
  ).trim();

  const reasons = evidence
    .map((e) => e.detectionReason)
    .filter((r): r is DetectionReason => r != null);
  const urlCount = reasons.filter((r) => r === "url").length;
  const windowCount = reasons.filter((r) => r === "window").length;
  const appCount = reasons.filter((r) => r === "app").length;
  const detectedVia: DetectionReason =
    urlCount >= windowCount && urlCount >= appCount
      ? "url"
      : windowCount >= appCount
        ? "window"
        : "app";

  return { provider, title, detectedVia };
}

/** Sort audio items by timestamp and merge transcripts, deduping consecutive identical lines. */
export function mergeTranscripts(audio: ScreenpipeItem[]): string {
  const withTime = audio
    .map((a) => ({
      a,
      t: parseItemTime(a)?.getTime() ?? 0,
      text: (a.content?.transcription ?? a.content?.transcript ?? a.content?.text ?? "").trim(),
    }))
    .filter((x) => x.text)
    .sort((p, q) => p.t - q.t);

  const lines: string[] = [];
  let last = "";
  for (const { text } of withTime) {
    if (text !== last) {
      lines.push(text);
      last = text;
    }
  }
  return lines.join("\n");
}
