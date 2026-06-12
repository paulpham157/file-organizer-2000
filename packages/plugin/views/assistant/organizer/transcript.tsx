import * as React from "react";
import { TFile, Notice } from "obsidian";
import FileOrganizer from "../../../index";
import { logger } from "../../../services/logger";

interface TranscriptionButtonProps {
  plugin: FileOrganizer;
  file: TFile;
  content: string;
}

export const TranscriptionButton: React.FC<TranscriptionButtonProps> = ({
  plugin,
  file,
  content,
}) => {
  const [transcribing, setTranscribing] = React.useState<boolean>(false);

  // Check that embedded audio files exist (size limits handled by server)
  const checkAudioFiles = () => {
    const audioRegex = /!\[\[(.*?\.(mp3|wav|m4a|ogg|webm))]]/gi;
    const matches = Array.from(content.matchAll(audioRegex));

    if (matches.length === 0) {
      return { valid: false, error: "No audio files found" };
    }

    return { valid: true };
  };

  const handleTranscribe = async () => {
    // Check file sizes before starting
    const validation = checkAudioFiles();
    if (!validation.valid) {
      new Notice(validation.error || "Cannot transcribe audio files", 8000);
      return;
    }

    setTranscribing(true);
    try {
      const audioRegex = /!\[\[(.*?\.(mp3|wav|m4a|ogg|webm))]]/gi;
      const matches = Array.from(content.matchAll(audioRegex));

      if (matches.length === 0) {
        new Notice("No audio files found");
        return;
      }

      let transcribedCount = 0;
      let skippedCount = 0;

      for (const match of matches) {
        const audioFileName = match[1];
        const audioFile = plugin.app.metadataCache.getFirstLinkpathDest(
          audioFileName,
          "."
        );

        if (!(audioFile instanceof TFile)) {
          logger.error(`Audio file not found: ${audioFileName}`);
          new Notice(`Audio file not found: ${audioFileName}`);
          continue;
        }

        // Check if transcript already exists
        if (plugin.hasExistingTranscript(content, audioFileName)) {
          logger.info(`Transcript already exists for: ${audioFileName}`);
          new Notice(`Transcript already exists for: ${audioFileName}`, 3000);
          skippedCount++;
          continue;
        }

        const transcript = await plugin.generateTranscriptFromAudio(audioFile);
        await plugin.appendTranscriptToActiveFile(
          file,
          audioFileName,
          transcript
        );
        new Notice(`Transcript added for: ${audioFileName}`);
        transcribedCount++;
      }

      if (transcribedCount > 0) {
        new Notice(`Completed transcribing ${transcribedCount} audio file(s)${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`);
      } else if (skippedCount > 0) {
        new Notice(`All ${skippedCount} audio file(s) already have transcripts`);
      }
    } catch (error) {
      logger.error("Error transcribing audio:", error);
      new Notice("Error transcribing audio");
    } finally {
      setTranscribing(false);
    }
  };

  const validation = checkAudioFiles();

  return (
    <div className="flex flex-col gap-2">
      <button
        className="flex items-center gap-2 bg-[--interactive-accent] text-[--text-on-accent] px-4 py-2 hover:bg-[--interactive-accent-hover] disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => { void handleTranscribe(); }}
        disabled={transcribing || !validation.valid}
        title={!validation.valid ? validation.error : undefined}
      >
        {transcribing ? (
          <>
            <span className="animate-spin">⟳</span>
            <span>Transcribing...</span>
          </>
        ) : (
          "Transcribe Audio"
        )}
      </button>
      {!validation.valid && validation.error && (
        <div className="text-xs text-[--text-error] px-2">
          {validation.error}
        </div>
      )}
    </div>
  );
};
