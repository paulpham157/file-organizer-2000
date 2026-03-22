import React, { useRef } from "react";
import { Notice } from "obsidian";
import { extractSelectionToNewNote } from "../../../../commands/extract-selection-to-note";
import { ToolHandlerProps } from "./types";

export function ExtractSelectionToNewNoteHandler({
  toolInvocation,
  handleAddResult,
  app,
}: ToolHandlerProps) {
  const hasFetchedRef = useRef(false);

  React.useEffect(() => {
    const run = async () => {
      if (hasFetchedRef.current || "result" in toolInvocation) return;
      hasFetchedRef.current = true;

      const args = toolInvocation.args as {
        title?: string;
        message?: string;
      };
      const raw = args.title?.trim() ?? "";
      const options = raw !== "" ? { title: raw } : undefined;

      try {
        const result = await extractSelectionToNewNote(app, options);
        if (result.ok) {
          const name =
            result.newFilePath.split("/").pop() ?? result.newFilePath;
          new Notice(`Extracted to ${name}`, 3500);
          handleAddResult(
            JSON.stringify({
              success: true,
              newFilePath: result.newFilePath,
              linkInserted: result.linkInserted,
            })
          );
        } else {
          handleAddResult(
            JSON.stringify({ success: false, error: result.error })
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        handleAddResult(JSON.stringify({ success: false, error: msg }));
      }
    };
    run();
  }, [toolInvocation, handleAddResult, app]);

  return (
    <div className="text-sm text-[--text-muted]">
      {"result" in toolInvocation
        ? "Extract complete"
        : "Extracting selection to new note…"}
    </div>
  );
}
