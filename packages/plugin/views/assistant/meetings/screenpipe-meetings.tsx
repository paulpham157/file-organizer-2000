import React, { useState, useEffect, useCallback } from "react";
import { TFile } from "obsidian";
import { Button } from "../ai-chat/button";
import { FileText, FilePlus, RefreshCw } from "lucide-react";
import FileOrganizer from "../../../index";
import { tw } from "../../../lib/utils";
import { Notice } from "obsidian";
import { logger } from "../../../services/logger";
import {
  parseScreenpipeTimestamp,
  ScreenpipeClient,
  ScreenpipeResult,
} from "../../../services/screenpipe-client";
import { getAvailablePath } from "../../../fileUtils";
import {
  getMeetingLikeReason,
  isMeetingLike,
  MEETING_APP_QUERIES,
  MEETING_BROWSER_URL_QUERIES,
} from "./meeting-predicate";
import {
  buildSessionTitle,
  groupMeetingSessions,
  isSessionValidByEvidence,
  mergeTranscripts,
  type MeetingSession,
  type ScreenpipeItem,
} from "./screenpipe-meetings-utils";
import { getApiError, readResponseJson, type ApiErrorBody } from "../../../lib/api-json";
import { obsidianFetch } from "../../../lib/obsidian-fetch";

interface ScreenpipeMeetingsProps {
  plugin: FileOrganizer;
}

const PER_QUERY_LIMIT = 100;
const COMBINED_DETECTION_CAP = 300;
const AUDIO_LIMIT_PER_SESSION = 200;
const AUDIO_FETCH_CONCURRENCY = 3;
const PREVIEW_TRANSCRIPT_CHARS = 80;

/** Run at most `concurrency` async tasks at a time; preserve order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
   
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = Array.from({ length: items.length }, () => undefined as R);
  let nextIdx = 0;
  async function worker(): Promise<void> {
    while (nextIdx < items.length) {
      const i = nextIdx++;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

export const ScreenpipeMeetings: React.FC<ScreenpipeMeetingsProps> = ({
  plugin,
}) => {
  const [sessions, setSessions] = useState<MeetingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const fetchMeetings = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setUnavailable(false);

      try {
        const client = new ScreenpipeClient(plugin.settings.screenpipeApiUrl);
        const available = await client.isAvailable();
        if (!available) {
          setUnavailable(true);
          setSessions([]);
          return;
        }

        const rangeEnd = new Date();
        const hours = plugin.settings.screenpipeTimeRange || 6;
        const rangeStart = new Date(
          rangeEnd.getTime() - hours * 60 * 60 * 1000
        );
        const startIso = rangeStart.toISOString();
        const endIso = rangeEnd.toISOString();
        const searchOpts = { allowHigherLimit: true as const };
        const baseParams = {
          limit: PER_QUERY_LIMIT,
          start_time: startIso,
          end_time: endIso,
        };

        const queries: Promise<ScreenpipeResult[]>[] = [];

        for (const appName of MEETING_APP_QUERIES) {
          queries.push(
            client
              .search({ ...baseParams, app_name: appName }, searchOpts)
              .catch((err) => {
                logger.error(`ScreenPipe app_name query failed: ${appName}`, err);
                return [] as ScreenpipeResult[];
              })
          );
        }

        for (const browserUrl of MEETING_BROWSER_URL_QUERIES) {
          queries.push(
            client
              .search({ ...baseParams, browser_url: browserUrl }, searchOpts)
              .catch((err) => {
                logger.error(`ScreenPipe browser_url query failed: ${browserUrl}`, err);
                return [] as ScreenpipeResult[];
              })
          );
        }

        const queryResults = await Promise.all(queries);

        const seen = new Set<string>();
        const detection: ScreenpipeResult[] = [];
        for (const batch of queryResults) {
          for (const r of batch) {
            if (detection.length >= COMBINED_DETECTION_CAP) break;
            const dedupeKey = `${r.content?.timestamp ?? ""}|${r.content?.app_name ?? ""}|${r.content?.window_name ?? ""}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            detection.push(r);
          }
        }

        const normalized: ScreenpipeItem[] = detection.map((r) => {
          const c = r.content;
          const reason = c ? getMeetingLikeReason(c) : null;
          return {
            type: r.type,
            timestamp: c?.timestamp,
            time: c?.timestamp,
            content: c
              ? {
                  ...c,
                  transcript: c.transcription,
                }
              : undefined,
            detectionReason: reason ?? undefined,
          };
        });

        const meetingHits = normalized.filter((item) =>
          isMeetingLike(item.content ?? {})
        );

        const sessionBases = groupMeetingSessions(meetingHits);
        const validBases = sessionBases.filter(isSessionValidByEvidence);

        const builtSessions = await mapWithConcurrency(
          validBases,
          AUDIO_FETCH_CONCURRENCY,
          async (base) => {
            const padStart = new Date(
              Math.max(
                base.start.getTime() - 2 * 60 * 1000,
                rangeStart.getTime()
              )
            );
            const padEnd = new Date(
              Math.min(
                base.end.getTime() + 2 * 60 * 1000,
                rangeEnd.getTime()
              )
            );
            let audio: ScreenpipeItem[] = [];
            try {
              const audioResults = await client.search(
                {
                  content_type: "audio",
                  limit: AUDIO_LIMIT_PER_SESSION,
                  start_time: padStart.toISOString(),
                  end_time: padEnd.toISOString(),
                },
                searchOpts
              );
              audio = audioResults.map((r) => ({
                type: r.type,
                timestamp: r.content?.timestamp,
                time: r.content?.timestamp,
                content: {
                  ...r.content,
                  transcript: r.content?.transcription,
                },
              }));
            } catch (err) {
              logger.error("ScreenPipe audio fetch failed for session", err);
            }
            const transcript = mergeTranscripts(audio);
            const { provider, title, detectedVia } = buildSessionTitle(
              base.evidence
            );
            if (audio.length > 0) {
              console.debug(
                "[screenpipe meetings] session audio items:",
                audio.length
              );
            }
            return {
              key: base.key,
              provider,
              title,
              start: base.start,
              end: base.end,
              evidence: base.evidence,
              audio,
              transcript,
              detectedVia,
            } satisfies MeetingSession;
          }
        );

        console.debug(
          "[screenpipe meetings] detection:",
          detection.length,
          "meetingHits:",
          meetingHits.length,
          "sessions:",
          builtSessions.length
        );
        setSessions(builtSessions);
      } catch (error) {
        logger.error("ScreenPipe meetings fetch failed", error);
        setSessions([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      plugin.settings.screenpipeApiUrl,
      plugin.settings.screenpipeTimeRange,
    ]
  );

  useEffect(() => {
    if (!plugin.settings.enableScreenpipe) return;
    void fetchMeetings();
  }, [plugin.settings.enableScreenpipe, fetchMeetings]);

  if (!plugin.settings.enableScreenpipe) return null;

  if (isLoading) {
    return (
      <div className={tw("p-4 text-center text-[--text-muted]")}>
        Loading from ScreenPipe...
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className={tw("p-4")}>
        <div className={tw("flex items-center justify-between mb-2")}>
          <h3 className={tw("text-lg font-medium text-[--text-normal]")}>
            From ScreenPipe
          </h3>
          <button
            onClick={() => { void fetchMeetings(true); }}
            disabled={isRefreshing}
            className={tw(
              "flex items-center gap-1.5 px-2 py-1 text-xs",
              "bg-[--background-modifier-form-field] hover:bg-[--background-modifier-hover]",
              "border border-[--background-modifier-border] rounded",
              "text-[--text-normal]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors"
            )}
            title="Retry after starting ScreenPipe"
          >
            {isRefreshing ? (
              <RefreshCw className={tw("w-3.5 h-3.5 animate-spin")} />
            ) : (
              <>
                <RefreshCw className={tw("w-3.5 h-3.5")} />
                <span>Retry</span>
              </>
            )}
          </button>
        </div>
        <p className={tw("text-sm text-[--text-muted]")}>
          ScreenPipe unavailable. Start ScreenPipe (e.g. localhost:3030), then
          click Retry to load meetings—no need to reload Obsidian.
        </p>
      </div>
    );
  }

  /** Format ScreenPipe timestamp in user's local time (handles ISO, Unix s/ms). */
  const formatDate = (timestamp: string): string => {
    try {
      const d = parseScreenpipeTimestamp(timestamp);
      const t = d.getTime();
      if (Number.isNaN(t)) return timestamp;
      return (
        d.toLocaleDateString() +
        " " +
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    } catch {
      return timestamp;
    }
  };

  const formatRecordingLabel = (session: MeetingSession): string => {
    const startStr = session.start
      ? session.start.toISOString().slice(0, 10)
      : "";
    const title = (session.title || "Meeting").replace(/[^\w\s-]/g, "").slice(0, 30);
    return `ScreenPipe - ${title} - ${startStr}`.slice(0, 80);
  };

  const enhanceFromScreenPipe = async (
    transcript: string,
    currentNoteContent: string,
    activeFile: TFile,
    recordingDate: string | null,
    recordingFileName: string
  ) => {
    if (!transcript.trim()) {
      new Notice("No transcript for this session");
      return;
    }

    const originalRecordingSectionPattern = /^(Recording[s]?:.*?)\n\n---\n\n/s;
    const cleanedNoteContent = currentNoteContent.replace(
      originalRecordingSectionPattern,
      ""
    );

    const response = await obsidianFetch(
      `${plugin.getServerUrl()}/api/enhance-meeting-note`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${plugin.settings.API_KEY}`,
        },
        body: JSON.stringify({
          transcript,
          currentNoteContent: cleanedNoteContent,
          fileName: activeFile.basename,
          recordingDate,
          recordingFileName,
          recordingFilePath: "",
        }),
      }
    );

    if (!response.ok) {
      const errorData = await readResponseJson<ApiErrorBody>(response);
      throw new Error(getApiError(errorData) ?? "Enhancement failed");
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let enhancedContent = "";
    if (!reader) throw new Error("No response body");
    let streamDone = false;
    while (!streamDone) {
      const { done, value } = await reader.read();
      streamDone = done;
      if (!done && value) enhancedContent += decoder.decode(value, { stream: true });
    }

    enhancedContent = enhancedContent.replace(
      /^Recording[s]?:.*?\n\n---\n\n/s,
      ""
    );
    enhancedContent = enhancedContent.replace(
      /\n\nRecording[s]?:.*?\n\n---\n\n/g,
      "\n\n"
    );
    enhancedContent = enhancedContent.replace(
      /^Recording[s]?:.*?(!?\[\[.*?\]\]).*?\n\n---\n\n/s,
      ""
    );

    await plugin.app.vault.modify(activeFile, enhancedContent);
    new Notice("Note enhanced successfully!");
  };

  const handleEnhanceNote = async (session: MeetingSession) => {
    const activeFile = plugin.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice("Please open a note to enhance");
      return;
    }
    if (!session.transcript.trim()) {
      new Notice("No transcript for this session");
      return;
    }

    try {
      const currentNoteContent = await plugin.app.vault.read(activeFile);
      const recordingDate = session.start
        ? session.start.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : null;
      const recordingFileName = formatRecordingLabel(session);
      await enhanceFromScreenPipe(
        session.transcript,
        currentNoteContent,
        activeFile,
        recordingDate,
        recordingFileName
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Enhance failed";
      logger.error("Enhance from ScreenPipe failed", error);
      new Notice(msg);
    }
  };

  const handleCreateNote = async (session: MeetingSession) => {
    if (!session.transcript.trim()) {
      new Notice("No transcript for this session");
      return;
    }

    try {
      const folder = plugin.settings.recordingsFolderPath || "Recordings";
      await plugin.app.vault.adapter.mkdir(folder);
      const dateStr = session.start
        ? session.start.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const appName = (session.title ?? "Meeting")
        .replace(/[^\w\s-]/g, "")
        .slice(0, 30) || "Meeting";
      const baseFileName = `Meeting ${dateStr} ${appName}.md`;
      const desiredPath = `${folder}/${baseFileName}`;
      const filePath = await getAvailablePath(plugin.app, desiredPath);
      await plugin.app.vault.create(filePath, "");
      const newFile = plugin.app.vault.getAbstractFileByPath(filePath);
      if (!newFile || !(newFile instanceof TFile))
        throw new Error("Failed to create file");

      const recordingDate = session.start
        ? session.start.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : null;
      const recordingFileName = formatRecordingLabel(session);
      await enhanceFromScreenPipe(
        session.transcript,
        "",
        newFile,
        recordingDate,
        recordingFileName
      );
      void plugin.app.workspace.openLinkText(filePath, "", true);
      new Notice("Note created and enhanced.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Create note failed";
      logger.error("Create note from ScreenPipe failed", error);
      new Notice(msg);
    }
  };

  return (
    <div className={tw("p-4 flex-1 overflow-y-auto")}>
      <div className={tw("flex items-center justify-between mb-4")}>
        <h3 className={tw("text-lg font-medium text-[--text-normal]")}>
          From ScreenPipe
        </h3>
        <button
          onClick={() => { void fetchMeetings(true); }}
          disabled={isRefreshing}
          className={tw(
            "flex items-center gap-1.5 px-2 py-1 text-xs",
            "bg-[--background-modifier-form-field] hover:bg-[--background-modifier-hover]",
            "border border-[--background-modifier-border] rounded",
            "text-[--text-normal]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors"
          )}
          title="Refresh ScreenPipe meetings"
        >
          {isRefreshing ? (
            <RefreshCw className={tw("w-3.5 h-3.5 animate-spin")} />
          ) : (
            <>
              <RefreshCw className={tw("w-3.5 h-3.5")} />
              <span>Refresh</span>
            </>
          )}
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className={tw("text-sm text-[--text-muted]")}>
          No meetings in the last{" "}
          {plugin.settings.screenpipeTimeRange ?? 4} hours.
        </p>
      ) : (
        <div className={tw("space-y-2")}>
          {sessions.map((session, index) => {
            const transcriptPreview =
              session.transcript.trim().length > 0
                ? session.transcript
                    .slice(0, PREVIEW_TRANSCRIPT_CHARS)
                    .trim() +
                  (session.transcript.length > PREVIEW_TRANSCRIPT_CHARS
                    ? "…"
                    : "")
                : "No audio transcript found";
            const hasTranscript = session.transcript.trim().length > 0;
            const firstEvidence = session.evidence[0]?.content;
            const evidenceWindow = firstEvidence?.window_name ?? "—";
            const evidenceUrlRaw =
              firstEvidence?.browser_url ?? firstEvidence?.url ?? "";
            let evidenceHost = "—";
            if (evidenceUrlRaw) {
              try {
                evidenceHost = new URL(
                  evidenceUrlRaw.startsWith("http")
                    ? evidenceUrlRaw
                    : `https://${evidenceUrlRaw}`
                ).hostname;
              } catch {
                evidenceHost = evidenceUrlRaw.slice(0, 30);
              }
            }
            const timeRange =
              session.start && session.end
                ? `${formatDate(session.start.toISOString())} – ${formatDate(session.end.toISOString())}`
                : "—";

            return (
              <div
                key={`${session.key}-${session.start?.getTime() ?? index}`}
                className={tw(
                  "border border-[--background-modifier-border] rounded p-3 hover:bg-[--background-modifier-hover]"
                )}
              >
                <div
                  className={tw("flex items-start justify-between mb-2 gap-2")}
                >
                  <div className={tw("flex-1 min-w-0 pr-2")}>
                    <div
                      className={tw("flex items-start gap-2 mb-1 flex-wrap")}
                    >
                      <span
                        className={tw(
                          "text-sm font-medium text-[--text-normal]"
                        )}
                      >
                        {session.title}
                      </span>
                    </div>
                    <div
                      className={tw("text-xs text-[--text-muted] space-x-3")}
                    >
                      <span title="Session time range (from ScreenPipe)">
                        {timeRange}
                      </span>
                    </div>
                    <p
                      className={tw(
                        "text-xs text-[--text-muted] mt-0.5"
                      )}
                      title="Evidence: window and URL host"
                    >
                      {evidenceWindow}
                      {evidenceHost !== "—" ? ` · ${evidenceHost}` : ""}
                    </p>
                    <p
                      className={tw(
                        "text-xs text-[--text-muted] mt-0.5 capitalize"
                      )}
                      title="How this meeting was detected"
                    >
                      Detected via: {session.detectedVia}
                    </p>
                    <p
                      className={tw(
                        "text-xs text-[--text-muted] mt-1 truncate"
                      )}
                      title={
                        hasTranscript ? session.transcript : undefined
                      }
                    >
                      {transcriptPreview}
                    </p>
                  </div>
                </div>
                <div className={tw("flex items-center gap-2 mt-2")}>
                  <Button
                    onClick={() => { void handleEnhanceNote(session); }}
                    disabled={!hasTranscript}
                    className={tw("flex items-center gap-2 text-xs")}
                    title={
                      hasTranscript
                        ? "Enhance active note with this transcript"
                        : "No transcript"
                    }
                  >
                    <FileText className={tw("w-3 h-3")} />
                    Enhance note
                  </Button>
                  <Button
                    onClick={() => { void handleCreateNote(session); }}
                    disabled={!hasTranscript}
                    className={tw("flex items-center gap-2 text-xs")}
                    title={
                      hasTranscript
                        ? "Create new note from this transcript"
                        : "No transcript"
                    }
                  >
                    <FilePlus className={tw("w-3 h-3")} />
                    Create note
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
