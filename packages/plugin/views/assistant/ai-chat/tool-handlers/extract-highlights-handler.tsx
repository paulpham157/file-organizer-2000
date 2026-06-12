import React, { useRef } from "react";
import { App, TFile, MarkdownView } from "obsidian";
import { ToolHandlerProps } from "./types";
import { resolveFile } from "./resolve-file";

const DEFAULT_MAX_CHARS = 30_000;

interface ExtractHighlightsSuccess {
  scope: string;
  filePath?: string;
  filePaths?: string[];
  content: string | Array<{ path: string; content: string }>;
}

interface ExtractHighlightsError {
  error: string;
  hint?: string;
}

export function ExtractHighlightsHandler({
  toolInvocation,
  handleAddResult,
  app,
}: ToolHandlerProps) {
  const hasFetchedRef = useRef(false);

  const truncate = (text: string, maxChars: number): string => {
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + "\n\n[Content truncated...]";
  };

  React.useEffect(() => {
    const run = async () => {
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const args = toolInvocation.args as {
          scope: "selection" | "document" | "files";
          filePath?: string;
          filePaths?: string[];
          maxChars?: number;
        };
        const scope = args.scope ?? "document";
        const maxChars = args.maxChars ?? DEFAULT_MAX_CHARS;

        try {
          if (scope === "selection") {
            const view = app.workspace.getActiveViewOfType(MarkdownView);
            if (!view?.editor) {
              handleAddResult(
                JSON.stringify({
                  error: "No active editor",
                  hint: "Open a note and select text, or use scope: 'document'.",
                })
              );
              return;
            }
            const selectedText = view.editor.getSelection();
            if (!selectedText || selectedText.length === 0) {
              handleAddResult(
                JSON.stringify({
                  error: "No selection",
                  hint: "Select text in the editor or use scope: 'document'.",
                })
              );
              return;
            }
            const content = truncate(selectedText, maxChars);
            handleAddResult(
              JSON.stringify({
                scope: "selection",
                content,
              })
            );
            return;
          }

          if (scope === "document") {
            const file = args.filePath?.trim()
              ? resolveFile(app, args.filePath)
              : app.workspace.getActiveFile();
            if (!file || !(file instanceof TFile)) {
              handleAddResult(
                JSON.stringify({
                  error: "No file found",
                  hint: "Open a note or pass a valid filePath from the Attached file paths.",
                })
              );
              return;
            }
            const content = await app.vault.read(file);
            const truncated = truncate(content, maxChars);
            handleAddResult(
              JSON.stringify({
                scope: "document",
                filePath: file.path,
                content: truncated,
              })
            );
            return;
          }

          if (scope === "files") {
            const paths = args.filePaths ?? [];
            if (paths.length === 0) {
              handleAddResult(
                JSON.stringify({
                  error: "No file paths provided",
                  hint: "Pass filePaths from the Attached file paths for scope 'files'.",
                })
              );
              return;
            }
            const results: Array<{ path: string; content: string }> = [];
            for (const p of paths) {
              const file = resolveFile(app, p);
              if (!file || !(file instanceof TFile)) {
                results.push({ path: p, content: "" });
                continue;
              }
              const content = await app.vault.read(file);
              results.push({
                path: file.path,
                content: truncate(content, maxChars),
              });
            }
            handleAddResult(
              JSON.stringify({
                scope: "files",
                filePaths: results.map((r) => r.path),
                content: results,
              })
            );
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          handleAddResult(
            JSON.stringify({
              error: `Failed to extract content: ${message}`,
            })
          );
        }
      }
    };
    void run();
  }, [toolInvocation, handleAddResult, app]);

  const isComplete = "result" in toolInvocation;

  return (
    <div className="text-sm">
      {!isComplete ? (
        <div className="text-[--text-muted]">Extracting content...</div>
      ) : (
        <div className="text-[--text-normal]">
          Done — content ready for highlights
        </div>
      )}
    </div>
  );
}
