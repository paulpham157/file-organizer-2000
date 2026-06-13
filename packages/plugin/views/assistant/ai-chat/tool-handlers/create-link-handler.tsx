import React, { useRef } from "react";
import { TFile } from "obsidian";
import { parseJsonString } from "../../../../lib/api-json";
import { ToolHandlerProps } from "./types";
import { resolveFile } from "./resolve-file";

interface CreateLinkArgs {
  sourcePath: string;
  targetPath: string;
  alias?: string;
  message: string;
}

export function CreateLinkHandler({
  toolInvocation,
  handleAddResult,
  app,
}: ToolHandlerProps) {
  const hasFetchedRef = useRef(false);

  React.useEffect(() => {
    const execute = async () => {
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const args = toolInvocation.args as CreateLinkArgs;

        try {
          // Resolve source file
          let sourceFile: TFile | null;
          if (!args.sourcePath?.trim()) {
            const active = app.workspace.getActiveFile();
            sourceFile = active && active.extension === "md" ? active : null;
            if (!sourceFile) {
              handleAddResult(
                JSON.stringify({
                  success: false,
                  message: "No current file open",
                })
              );
              return;
            }
          } else {
            sourceFile = resolveFile(app, args.sourcePath);
            if (!sourceFile) {
              handleAddResult(
                JSON.stringify({
                  success: false,
                  message: `File not found: ${args.sourcePath}`,
                })
              );
              return;
            }
          }

          // Resolve target file
          const targetFile = resolveFile(app, args.targetPath);
          if (!targetFile) {
            handleAddResult(
              JSON.stringify({
                success: false,
                message: `File not found: ${args.targetPath}`,
              })
            );
            return;
          }

          // Prevent self-link
          if (sourceFile.path === targetFile.path) {
            handleAddResult(
              JSON.stringify({
                success: false,
                message: "Cannot link a note to itself",
              })
            );
            return;
          }

          // Build wikilink (path without .md per Obsidian convention)
          const pathWithoutExt = targetFile.path.replace(/\.md$/, "");
          const aliasTrimmed =
            args.alias != null ? String(args.alias).trim() : "";
          const wikilink =
            aliasTrimmed !== ""
              ? `[[${pathWithoutExt}|${aliasTrimmed}]]`
              : `[[${pathWithoutExt}]]`;

          const currentContent = await app.vault.read(sourceFile);

          // Avoid duplicate links
          if (currentContent.includes(wikilink)) {
            handleAddResult(
              JSON.stringify({
                success: true,
                message: "Link already present.",
                alreadyPresent: true,
                sourcePath: sourceFile.path,
                targetPath: targetFile.path,
              })
            );
            return;
          }

          const newContent = `${currentContent}\n\n${wikilink}`;
          await app.vault.modify(sourceFile, newContent);

          handleAddResult(
            JSON.stringify({
              success: true,
              message: `Added link to ${targetFile.basename}`,
              sourcePath: sourceFile.path,
              targetPath: targetFile.path,
            })
          );
        } catch (error) {
          handleAddResult(
            JSON.stringify({
              success: false,
              message: (error as Error).message,
            })
          );
        }
      }
    };

    void execute();
  }, [toolInvocation, handleAddResult, app]);

  const isComplete = "result" in toolInvocation;
  let statusText = "Adding link...";
  if (isComplete && typeof toolInvocation.result === "string") {
    try {
      const result = parseJsonString<{
        success?: boolean;
        alreadyPresent?: boolean;
        message?: string;
      }>(toolInvocation.result);
      if (result.success) {
        statusText = result.alreadyPresent ? "Link already present" : "Link added";
      } else {
        statusText = result.message || "Failed";
      }
    } catch {
      statusText = "Done";
    }
  }

  return (
    <div className="text-sm text-[--text-muted]">
      {!isComplete ? "Adding link..." : statusText}
    </div>
  );
}
