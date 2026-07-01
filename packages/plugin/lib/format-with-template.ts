import { Notice, TFile } from "obsidian";
import FileOrganizer from "../index";
import { logger } from "../services/logger";
import {
  finalizeYouTubeFormattedNote,
  isYoutubeVideoTemplate,
  prepareYouTubeFormatContent,
  type YouTubeFetchedContent,
} from "../inbox/services/youtube-service";

export type FormatBehavior = "override" | "newFile" | "append";

export interface FormatNoteWithTemplateOptions {
  plugin: FileOrganizer;
  file: TFile;
  templateName: string;
  baseContent?: string;
  formatBehavior?: FormatBehavior;
  /** Default true — explicit user actions should fetch transcripts. */
  enableTranscriptFetching?: boolean;
  /** When true, warn but still format if the transcript is missing. Default true. */
  allowFormatWithoutTranscript?: boolean;
  renameToVideoTitle?: boolean;
  onFileRename?: (file: TFile) => void;
}

export interface FormatNoteWithTemplateResult {
  file: TFile;
  youtubeContent: YouTubeFetchedContent | null;
  skipped?: boolean;
  skipReason?: string;
}

async function maybeRenameFileToVideoTitle(
  plugin: FileOrganizer,
  file: TFile,
  videoTitle: string,
  onFileRename?: (file: TFile) => void
): Promise<TFile> {
  try {
    const sanitizedTitle = videoTitle
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 100);

    const newFileName = `${sanitizedTitle}.md`;
    const newPath = `${file.parent?.path || ""}/${newFileName}`.replace(
      /^\/+/,
      ""
    );

    if (!sanitizedTitle || newFileName === file.name) {
      return file;
    }

    let uniquePath = newPath;
    if (await plugin.app.vault.adapter.exists(newPath)) {
      let counter = 1;
      const parentDir = file.parent?.path || "";
      while (await plugin.app.vault.adapter.exists(uniquePath)) {
        uniquePath = `${parentDir}/${sanitizedTitle} (${counter}).md`.replace(
          /^\/+/,
          ""
        );
        counter++;
        if (counter > 100) break;
      }
    }

    if (await plugin.app.vault.adapter.exists(uniquePath)) {
      return file;
    }

    await plugin.app.fileManager.renameFile(file, uniquePath);
    const renamedFile = plugin.app.vault.getAbstractFileByPath(uniquePath);
    if (renamedFile instanceof TFile) {
      onFileRename?.(renamedFile);
      return renamedFile;
    }
  } catch (error) {
    logger.warn("Failed to rename file with video title:", error);
  }

  return file;
}

/**
 * Shared manual-format flow for Organizer and chat slash commands:
 * prepare transcript → stream format → post-process YouTube note.
 */
export async function formatNoteWithTemplate(
  options: FormatNoteWithTemplateOptions
): Promise<FormatNoteWithTemplateResult> {
  const {
    plugin,
    templateName,
    formatBehavior = "override",
    enableTranscriptFetching = true,
    allowFormatWithoutTranscript = true,
    renameToVideoTitle = formatBehavior === "override",
    onFileRename,
  } = options;

  let file = options.file;
  let baseContent = options.baseContent;
  if (baseContent === undefined) {
    baseContent = await plugin.app.vault.read(file);
    if (typeof baseContent !== "string") {
      throw new Error("File content is not a string");
    }
  }

  if (isYoutubeVideoTemplate(templateName)) {
    new Notice("Fetching YouTube transcript...", 2000);
  }

  const prep = await prepareYouTubeFormatContent(plugin, {
    baseContent,
    templateName,
    enableTranscriptFetching,
  });

  if (isYoutubeVideoTemplate(templateName)) {
    if (prep.transcriptFetchSkipped) {
      const message =
        "YouTube transcript fetching is disabled in settings. Enable it in plugin settings to format YouTube videos.";
      new Notice(message, 6000);
      return { file, youtubeContent: null, skipped: true, skipReason: message };
    }

    if (prep.videoId && !prep.youtubeContent) {
      const message =
        "Could not fetch YouTube transcript. The note was not formatted.";
      if (!allowFormatWithoutTranscript) {
        new Notice(message, 6000);
        return { file, youtubeContent: null, skipped: true, skipReason: message };
      }
      new Notice(
        "Could not fetch YouTube transcript. Formatting with limited context.",
        6000
      );
    } else if (prep.youtubeContent) {
      new Notice("Transcript fetched, formatting...", 2000);
    }
  }

  const formattingInstruction =
    await plugin.getTemplateInstructions(templateName);

  if (
    formatBehavior === "override" &&
    renameToVideoTitle &&
    isYoutubeVideoTemplate(templateName) &&
    prep.videoId &&
    prep.videoTitle
  ) {
    file = await maybeRenameFileToVideoTitle(
      plugin,
      file,
      prep.videoTitle,
      onFileRename
    );
  }

  if (formatBehavior === "override") {
    await plugin.streamFormatInCurrentNote({
      file,
      content: prep.formatContent,
      formattingInstruction,
    });
    await finalizeYouTubeFormattedNote(
      plugin.app,
      file,
      templateName,
      prep.youtubeContent ?? undefined
    );
  } else if (formatBehavior === "newFile") {
    const newFile = await plugin.streamFormatInSplitView({
      file,
      content: prep.formatContent,
      formattingInstruction,
    });
    if (newFile) {
      await finalizeYouTubeFormattedNote(
        plugin.app,
        newFile,
        templateName,
        prep.youtubeContent ?? undefined
      );
      file = newFile;
    }
  } else if (formatBehavior === "append") {
    await plugin.streamFormatAppendInCurrentNote({
      file,
      content: prep.formatContent,
      formattingInstruction,
    });
    await finalizeYouTubeFormattedNote(
      plugin.app,
      file,
      templateName,
      prep.youtubeContent ?? undefined
    );
  }

  return { file, youtubeContent: prep.youtubeContent };
}
