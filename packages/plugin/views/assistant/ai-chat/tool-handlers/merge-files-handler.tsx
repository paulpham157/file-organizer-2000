import React, { useRef, useState } from "react";
import { TFile, Notice, Modal } from "obsidian";
import { ToolHandlerProps } from "./types";
import { resolveFile } from "./resolve-file";

interface MergeFilesArgs {
  sourceFiles: string[];
  outputFileName: string;
  outputFolder?: string;
  separator?: string;
  deleteSource?: boolean;
  message?: string;
}

function confirmOverwrite(
  app: ToolHandlerProps["app"],
  outputFileName: string
): Promise<boolean> {
  return new Promise((resolve) => {
    class OverwriteModal extends Modal {
      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Overwrite existing file?" });
        contentEl.createEl("p", {
          text: `File "${outputFileName}.md" already exists. Overwrite?`,
        });
        const buttonContainer = contentEl.createDiv({
          attr: { style: "display: flex; gap: 10px; margin-top: 1em;" },
        });
        buttonContainer
          .createEl("button", { text: "Cancel" })
          .addEventListener("click", () => {
            resolve(false);
            this.close();
          });
        buttonContainer
          .createEl("button", {
            text: "Overwrite",
            attr: { style: "background: var(--interactive-accent);" },
          })
          .addEventListener("click", () => {
            resolve(true);
            this.close();
          });
      }
    }
    const modal = new OverwriteModal(app);
    modal.open();
  });
}

export function MergeFilesHandler({
  toolInvocation,
  handleAddResult,
  app,
}: ToolHandlerProps) {
  const hasFetchedRef = useRef(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [validFiles, setValidFiles] = useState<TFile[]>([]);
  const [invalidPaths, setInvalidPaths] = useState<string[]>([]);

  const hasAutoRunRef = useRef(false);

  React.useEffect(() => {
    const validateFiles = () => {
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const { sourceFiles } = toolInvocation.args as MergeFilesArgs;

        const valid: TFile[] = [];
        const invalid: string[] = [];
        const seenPaths = new Set<string>();

        sourceFiles.forEach((path) => {
          const file = resolveFile(app, path);
          if (file instanceof TFile) {
            if (!seenPaths.has(file.path)) {
              seenPaths.add(file.path);
              valid.push(file);
            }
          } else {
            invalid.push(path);
          }
        });

        setValidFiles(valid);
        setInvalidPaths(invalid);
      }
    };

    validateFiles();
  }, [toolInvocation, app]);

  React.useEffect(() => {
    if (
      hasAutoRunRef.current ||
      "result" in toolInvocation ||
      validFiles.length < 2 ||
      invalidPaths.length > 0
    ) {
      return;
    }
    const { deleteSource = false, outputFileName, outputFolder = "" } =
      toolInvocation.args as MergeFilesArgs;
    if (deleteSource) return;
    const outputPath = outputFolder
      ? `${outputFolder}/${outputFileName}.md`
      : `${outputFileName}.md`;
    if (app.vault.getAbstractFileByPath(outputPath) instanceof TFile) {
      return;
    }

    hasAutoRunRef.current = true;
    const run = async () => {
      const { separator = "\n\n---\n\n" } =
        toolInvocation.args as MergeFilesArgs;
      try {
        const contents: string[] = [];
        for (const file of validFiles) {
          contents.push(await app.vault.read(file));
        }
        const mergedContent = contents.join(separator);
        await app.vault.create(outputPath, mergedContent);
        setIsDone(true);
        new Notice(
          `Merged ${validFiles.length} files into "${outputFileName}.md"`
        );
        handleAddResult(
          JSON.stringify({
            success: true,
            mergedFile: outputPath,
            sourceFileCount: validFiles.length,
            deletedSource: false,
            message: `Merged ${validFiles.length} files into "${outputFileName}.md"`,
          })
        );
      } catch (err) {
        hasAutoRunRef.current = false;
        setIsDone(true);
        const errorMessage = err instanceof Error ? err.message : String(err);
        new Notice(`Failed to merge: ${errorMessage}`);
        handleAddResult(
          JSON.stringify({ success: false, error: errorMessage })
        );
      }
    };
    void run();
  }, [toolInvocation, validFiles, invalidPaths, app, handleAddResult]);

  const handleConfirmMerge = async () => {
    const {
      outputFileName,
      outputFolder = "",
      separator = "\n\n---\n\n",
      deleteSource = false,
    } = toolInvocation.args as MergeFilesArgs;

    try {
      const contents: string[] = [];
      for (const file of validFiles) {
        const content = await app.vault.read(file);
        contents.push(content);
      }

      const mergedContent = contents.join(separator);

      const outputPath = outputFolder
        ? `${outputFolder}/${outputFileName}.md`
        : `${outputFileName}.md`;

      const existingFile = app.vault.getAbstractFileByPath(outputPath);
      if (existingFile instanceof TFile) {
        const shouldOverwrite = await confirmOverwrite(app, outputFileName);
        if (!shouldOverwrite) {
          setIsDone(true);
          handleAddResult(
            JSON.stringify({
              success: false,
              message: "User cancelled merge (file already exists)",
            })
          );
          return;
        }
        await app.vault.modify(existingFile, mergedContent);
      } else {
        await app.vault.create(outputPath, mergedContent);
      }

      if (deleteSource) {
        for (const file of validFiles) {
          await app.fileManager.trashFile(file);
        }
      }

      setIsDone(true);

      const message = deleteSource
        ? `Merged ${validFiles.length} files into "${outputFileName}.md" and deleted source files`
        : `Merged ${validFiles.length} files into "${outputFileName}.md"`;

      new Notice(message);

      handleAddResult(
        JSON.stringify({
          success: true,
          mergedFile: outputPath,
          sourceFileCount: validFiles.length,
          deletedSource: deleteSource,
          message,
        })
      );
    } catch (error) {
      setIsDone(true);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new Notice(`Failed to merge files: ${errorMessage}`);
      handleAddResult(
        JSON.stringify({
          success: false,
          error: errorMessage,
        })
      );
    }
  };

  const handleCancel = () => {
    setIsDone(true);
    handleAddResult(
      JSON.stringify({
        success: false,
        message: "User cancelled merge",
      })
    );
  };

  const {
    message: reason,
    outputFileName,
    deleteSource = false,
  } = toolInvocation.args as MergeFilesArgs;
  const isComplete = "result" in toolInvocation;

  if (isComplete || isDone) {
    return (
      <div className="text-sm border-b border-[--background-modifier-border] pb-2">
        <div className="text-[--text-success] text-xs">
          {isDone && !isConfirmed ? "✗ Merge cancelled" : "✓ Files merged"}
        </div>
      </div>
    );
  }

  if (validFiles.length === 0 && invalidPaths.length > 0) {
    return (
      <div className="text-sm border-b border-[--background-modifier-border] pb-2">
        <div className="text-[--text-error] text-xs">
          ✗ No valid files to merge. All paths were invalid.
        </div>
      </div>
    );
  }

  if (validFiles.length < 2) {
    return (
      <div className="text-sm border-b border-[--background-modifier-border] pb-2">
        <div className="text-[--text-error] text-xs">
          ✗ Need at least 2 files to merge.
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 border border-[--background-modifier-border]">
      <div className="flex items-start gap-2">
        <span className="text-[--text-accent] text-lg">⚡</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-[--text-normal] mb-1">
            Confirm Merge
          </div>
          <div className="text-xs text-[--text-muted] mb-2">{reason}</div>
        </div>
      </div>

      <div className="text-xs space-y-1">
        <div className="font-semibold text-[--text-muted] uppercase">
          Files to merge ({validFiles.length})
        </div>
        {validFiles.slice(0, 5).map((file) => (
          <div key={file.path} className="text-[--text-normal] pl-2">
            • {file.basename}
          </div>
        ))}
        {validFiles.length > 5 && (
          <div className="text-[--text-faint] pl-2">
            ...and {validFiles.length - 5} more
          </div>
        )}
      </div>

      <div className="text-xs space-y-1">
        <div className="font-semibold text-[--text-muted] uppercase">
          Output file
        </div>
        <div className="text-[--text-normal] pl-2">📄 {outputFileName}.md</div>
      </div>

      {invalidPaths.length > 0 && (
        <div className="text-xs text-[--text-error]">
          ⚠ {invalidPaths.length} invalid path(s) will be skipped
        </div>
      )}

      {deleteSource && (
        <div className="p-2 bg-[--background-secondary] text-xs text-[--text-warning]">
          <strong>⚠ Warning:</strong> Source files will be moved to trash after
          merge
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          className="flex-1 px-3 py-1.5 text-xs border border-[--background-modifier-border] hover:bg-[--background-modifier-hover] text-[--text-normal]"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            setIsConfirmed(true);
            void handleConfirmMerge();
          }}
          className="flex-1 px-3 py-1.5 text-xs bg-[--interactive-accent] hover:bg-[--interactive-accent-hover] text-white"
        >
          Merge {validFiles.length} Files
        </button>
      </div>
    </div>
  );
}
