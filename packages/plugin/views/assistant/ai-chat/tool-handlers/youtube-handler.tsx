import React, { useRef, useState } from "react";
import { logger } from "../../../../services/logger";
import { addYouTubeContext, useContextItems } from "../use-context-items";
import {
  getYouTubeContent,
  extractYouTubeVideoId,
} from "../../../../inbox/services/youtube-service";
import { usePlugin } from "../../provider";
import { ToolHandlerProps } from "./types";

interface YouTubeArgs {
  videoId?: string;
}

function isThenable(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return typeof Reflect.get(value, "then") === "function";
}

export function YouTubeHandler({
  toolInvocation,
  handleAddResult,
}: ToolHandlerProps) {
  const plugin = usePlugin();
  const hasFetchedRef = useRef(false);
  const [fetchSuccess, setFetchSuccess] = useState<boolean | null>(null);

  React.useEffect(() => {
    const args = toolInvocation.args as YouTubeArgs;

    console.debug("[YouTube Handler] useEffect triggered", {
      toolName: toolInvocation.toolName,
      hasArgs: !!args,
      videoId: args.videoId,
      hasFetched: hasFetchedRef.current,
      hasResult: "result" in toolInvocation,
    });

    const handleYouTubeTranscript = async () => {
      if (hasFetchedRef.current || "result" in toolInvocation) {
        console.debug(
          "[YouTube Handler] Skipping - already fetched or has result",
          {
            hasFetched: hasFetchedRef.current,
            hasResult: "result" in toolInvocation,
          }
        );
        return;
      }

      console.debug("[YouTube Handler] Starting handler execution");
      hasFetchedRef.current = true;

      try {
        let videoId = args.videoId;

        if (isThenable(videoId)) {
          const errorMsg =
            "Invalid videoId: received a Promise instead of a string value";
          logger.error(errorMsg, { args: toolInvocation.args });
          handleAddResult(JSON.stringify({ error: errorMsg }));
          setFetchSuccess(false);
          return;
        }

        if (!videoId || typeof videoId !== "string") {
          const errorMsg = `Invalid videoId: videoId is required and must be a string. Received type: ${typeof videoId}, value: ${String(
            videoId
          ).substring(0, 100)}`;
          logger.error(errorMsg, { args: toolInvocation.args });
          handleAddResult(JSON.stringify({ error: errorMsg }));
          setFetchSuccess(false);
          return;
        }

        const extractedId = extractYouTubeVideoId(videoId);
        if (extractedId) {
          videoId = extractedId;
        } else if (!/^[a-zA-Z0-9_-]+$/.test(videoId)) {
          const errorMsg = `Invalid videoId format. Expected YouTube video ID or URL, got: ${videoId.substring(
            0,
            50
          )}`;
          logger.error(errorMsg);
          handleAddResult(JSON.stringify({ error: errorMsg }));
          setFetchSuccess(false);
          return;
        }

        console.debug(
          "[YouTube Handler] About to fetch content for videoId:",
          videoId
        );

        let title: string;
        let transcript: string;

        try {
          const contentResult = await getYouTubeContent(videoId, plugin);
          title = contentResult.title;
          transcript = contentResult.transcript;

          console.debug("[YouTube Handler] Successfully fetched content:", {
            title,
            transcriptLength: transcript.length,
          });
        } catch (error) {
          console.error("[YouTube Handler] Error in getYouTubeContent:", error);
          throw error;
        }

        console.debug("[YouTube Handler] About to add to context");
        try {
          addYouTubeContext({
            videoId,
            title,
            transcript,
          });
          console.debug("[YouTube Handler] Called addYouTubeContext");
        } catch (error) {
          console.error("[YouTube Handler] Error in addYouTubeContext:", error);
        }

        await new Promise(resolve => window.setTimeout(resolve, 100));

        const store = useContextItems.getState();

        if (!store.youtubeVideos) {
          console.error(
            "[YouTube Handler] ERROR: store.youtubeVideos is undefined!"
          );
          console.error("[YouTube Handler] Full store state:", store);
        }

        const addedVideo = store.youtubeVideos?.[`youtube-${videoId}`];

        if (!addedVideo) {
          console.error(
            "[YouTube Handler] ERROR: Video not found in store after addYouTubeContext!"
          );
          console.error("[YouTube Handler] Store state:", {
            youtubeVideos: store.youtubeVideos,
            youtubeVideosType: typeof store.youtubeVideos,
            allKeys: store.youtubeVideos
              ? Object.keys(store.youtubeVideos)
              : [],
            storeKeys: Object.keys(store),
          });
          addYouTubeContext({
            videoId,
            title,
            transcript,
          });
          await new Promise(resolve => window.setTimeout(resolve, 10));
          const store2 = useContextItems.getState();
          const addedVideo2 = store2.youtubeVideos?.[`youtube-${videoId}`];
          if (!addedVideo2) {
            console.error(
              "[YouTube Handler] ERROR: Video still not in store after retry!"
            );
            console.error("[YouTube Handler] Store2 state:", {
              youtubeVideos: store2.youtubeVideos,
              youtubeVideosType: typeof store2.youtubeVideos,
              allKeys: store2.youtubeVideos
                ? Object.keys(store2.youtubeVideos)
                : [],
            });
          } else {
            console.debug("[YouTube Handler] Successfully added on retry!");
          }
        }

        const finalStore = useContextItems.getState();
        console.debug("[YouTube Handler] Added to context:", {
          videoId,
          title,
          transcriptLength: transcript.length,
          foundInStore: !!addedVideo,
          allVideos: finalStore.youtubeVideos
            ? Object.keys(finalStore.youtubeVideos)
            : [],
          storeKeys: Object.keys(finalStore),
          youtubeVideosType: typeof finalStore.youtubeVideos,
        });

        const wordCount = transcript.split(/\s+/).length;

        const verifyStore = useContextItems.getState();
        const videoStillInStore =
          !!verifyStore.youtubeVideos?.[`youtube-${videoId}`];

        if (!videoStillInStore) {
          console.error(
            "[YouTube Handler] CRITICAL: Video not in store before handleAddResult! Re-adding..."
          );
          addYouTubeContext({ videoId, title, transcript });
          await new Promise(resolve => window.setTimeout(resolve, 50));
          const verifyStore2 = useContextItems.getState();
          if (!verifyStore2.youtubeVideos?.[`youtube-${videoId}`]) {
            console.error(
              "[YouTube Handler] CRITICAL: Video still not in store after re-add!"
            );
          }
        }

        const finalVerifyStore = useContextItems.getState();
        console.debug(
          "[YouTube Handler] About to call handleAddResult - video is in store:",
          {
            videoId,
            inStore: !!finalVerifyStore.youtubeVideos?.[`youtube-${videoId}`],
            allVideos: finalVerifyStore.youtubeVideos
              ? Object.keys(finalVerifyStore.youtubeVideos)
              : [],
            storeKeys: Object.keys(finalVerifyStore),
          }
        );

        await new Promise(resolve => window.setTimeout(resolve, 100));

        const finalCheckStore = useContextItems.getState();
        const finalCheckVideo =
          !!finalCheckStore.youtubeVideos?.[`youtube-${videoId}`];
        console.debug(
          "[YouTube Handler] Final store check before handleAddResult:",
          {
            videoInStore: finalCheckVideo,
            allVideos: finalCheckStore.youtubeVideos
              ? Object.keys(finalCheckStore.youtubeVideos)
              : [],
          }
        );

        const toolResultMessage = `YouTube Video Transcript Retrieved

Title: ${title}
Video ID: ${videoId}
Word Count: ${wordCount}

FULL TRANSCRIPT:
${transcript}

Please provide a comprehensive summary of this video, including:
- Main topics and themes
- Key points discussed
- Important information or insights
- Overall takeaway or conclusion

The full transcript is provided above - use it to create a detailed, accurate summary.`;

        console.debug(
          "[YouTube Handler] Calling handleAddResult with transcript length:",
          transcript.length
        );
        handleAddResult(toolResultMessage);

        console.debug(
          "[YouTube Handler] handleAddResult called - AI SDK should continue now"
        );
        setFetchSuccess(true);
      } catch (error) {
        logger.error("Error fetching YouTube transcript:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        handleAddResult(JSON.stringify({ error: errorMessage }));
        setFetchSuccess(false);
      }
    };

    void handleYouTubeTranscript();
  }, [toolInvocation.toolCallId, toolInvocation, handleAddResult, plugin]);

  if (fetchSuccess === null) {
    return (
      <div className="text-sm text-[--text-muted]">
        Fetching the video transcript...
      </div>
    );
  }

  if (fetchSuccess) {
    return (
      <div className="text-sm text-[--text-muted]">
        YouTube transcript successfully retrieved
      </div>
    );
  }

  return (
    <div className="text-sm text-[--text-error]">
      Failed to fetch YouTube transcript
    </div>
  );
}
