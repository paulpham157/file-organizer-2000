import React from "react";
import { usePlugin } from "../../provider";
import { TFile } from "obsidian";
import { ToolHandlerProps } from "./types";

interface AppendContentArgs {
  content: string;
  fileName?: string;
  message?: string;
}

export function AppendContentHandler({
  toolInvocation,
  handleAddResult,
}: ToolHandlerProps) {
  const plugin = usePlugin();
  const [isValidated, setIsValidated] = React.useState(false);

  const args = toolInvocation.args as AppendContentArgs;

  const handleAppendContent = async () => {
    try {
      const { content, fileName } = args;
      const activeFile = fileName
        ? plugin.app.vault.getAbstractFileByPath(fileName)
        : plugin.app.workspace.getActiveFile();

      if (activeFile instanceof TFile) {
        const currentContent = await plugin.app.vault.read(activeFile);
        await plugin.app.vault.modify(
          activeFile,
          currentContent + "\n\n" + content
        );
        setIsValidated(true);
        handleAddResult(
          JSON.stringify({
            success: true,
            message: `Content appended to ${activeFile.name}`,
          })
        );
      } else {
        handleAddResult(
          JSON.stringify({
            success: false,
            message: "No active file found to append content to",
          })
        );
      }
    } catch (error) {
      console.error("Error appending content:", error);
      handleAddResult(
        JSON.stringify({
          success: false,
          message: "Failed to append content to file",
        })
      );
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-4 border border-[--background-modifier-border]">
      <div className="text-[--text-normal]">
        {args.message ||
          "Would you like to append the following content?"}
      </div>

      <div className="bg-[--background-secondary] p-3">
        <pre className="text-sm text-[--text-muted] whitespace-pre-wrap">
          {args.content}
        </pre>
      </div>

      {!isValidated && (
        <div className="flex space-x-2">
          <button
            onClick={() => { void handleAppendContent(); }}
            className="px-4 py-2 bg-[--interactive-accent] text-[--text-on-accent] hover:bg-[--interactive-accent-hover]"
          >
            Append Content
          </button>
          <button
            onClick={() =>
              handleAddResult(
                JSON.stringify({
                  success: false,
                  message: "User declined to append content",
                })
              )
            }
            className="px-4 py-2 bg-[--background-modifier-border] text-[--text-normal] hover:bg-[--background-modifier-border-hover]"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
