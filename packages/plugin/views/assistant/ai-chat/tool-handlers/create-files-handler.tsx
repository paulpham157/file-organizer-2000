import React, { useRef, useState } from "react";
import { Notice } from "obsidian";
import { ToolHandlerProps, getToolArgs } from "./types";

interface FileToCreate {
  fileName: string;
  content: string;
  folder?: string;
}

interface CreateFilesArgs {
  files: FileToCreate[];
  linkInCurrentFile?: boolean;
  message?: string;
}

interface CreateFileResult {
  path: string;
  success: boolean;
  error?: string;
}

function normalizeFileToCreate(value: unknown): FileToCreate | null {
  if (typeof value !== "object" || value === null) return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.fileName !== "string" || typeof obj.content !== "string") {
    return null;
  }
  return {
    fileName: obj.fileName,
    content: obj.content,
    folder: typeof obj.folder === "string" ? obj.folder : "",
  };
}

export function CreateFilesHandler({
  toolInvocation,
  handleAddResult,
  app,
}: ToolHandlerProps) {
  const hasFetchedRef = useRef(false);
  const [createdFiles, setCreatedFiles] = useState<string[]>([]);

  const createFiles = async (
    files: FileToCreate[],
    linkInCurrentFile: boolean = true
  ) => {
    const results: CreateFileResult[] = [];
    const createdPaths: string[] = [];

    for (const fileData of files) {
      try {
        const fileName = fileData.fileName.endsWith(".md")
          ? fileData.fileName
          : `${fileData.fileName}.md`;

        const folder = fileData.folder || "";
        const fullPath = folder ? `${folder}/${fileName}` : fileName;

        if (folder) {
          const folderExists = app.vault.getAbstractFileByPath(folder);
          if (!folderExists) {
            await app.vault.createFolder(folder);
          }
        }

        const existingFile = app.vault.getAbstractFileByPath(fullPath);
        if (existingFile) {
          results.push({
            path: fullPath,
            success: false,
            error: "File already exists",
          });
          continue;
        }

        await app.vault.create(fullPath, fileData.content);
        createdPaths.push(fullPath);

        results.push({
          path: fullPath,
          success: true,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        results.push({
          path: fileData.fileName,
          success: false,
          error: errorMessage,
        });
      }
    }

    if (linkInCurrentFile && createdPaths.length > 0) {
      try {
        const activeFile = app.workspace.getActiveFile();
        if (activeFile) {
          const currentContent = await app.vault.read(activeFile);
          const links = createdPaths
            .map((path) => {
              const linkText = path.replace(/\.md$/, "");
              return `- [[${linkText}]]`;
            })
            .join("\n");

          const newContent = `${currentContent}\n\n${links}`;
          await app.vault.modify(activeFile, newContent);
        }
      } catch (error) {
        console.error("Error adding links to current file:", error);
      }
    }

    return { results, createdPaths };
  };

  React.useEffect(() => {
    const handleCreateFiles = async () => {
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const { files, linkInCurrentFile } =
          getToolArgs<CreateFilesArgs>(toolInvocation.args);

        const normalizedFiles = files
          .map(normalizeFileToCreate)
          .filter((f): f is FileToCreate => f !== null);

        const normalizedLinkInCurrentFile = linkInCurrentFile ?? true;

        try {
          const { results, createdPaths } = await createFiles(
            normalizedFiles,
            normalizedLinkInCurrentFile
          );

          setCreatedFiles(createdPaths);

          const successCount = results.filter((r) => r.success).length;
          const failCount = results.filter((r) => !r.success).length;

          handleAddResult(
            JSON.stringify({
              success: true,
              created: successCount,
              failed: failCount,
              files: results,
              message: `Created ${successCount} file(s)${failCount > 0 ? `, ${failCount} failed` : ""}`,
            })
          );

          new Notice(
            `Created ${successCount} file(s)${failCount > 0 ? `, ${failCount} failed` : ""}`
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          handleAddResult(
            JSON.stringify({
              success: false,
              error: `Failed to create files: ${errorMessage}`,
            })
          );
          new Notice(`Error creating files: ${errorMessage}`);
        }
      }
    };

    void handleCreateFiles();
  }, [toolInvocation, handleAddResult, app]);

  const { files, message } = getToolArgs<CreateFilesArgs>(toolInvocation.args);
  const isComplete = "result" in toolInvocation;

  return (
    <div className="text-sm border-b border-[--background-modifier-border] pb-2">
      <div className="text-[--text-muted] mb-1">{message}</div>
      {!isComplete ? (
        <div className="text-[--text-muted] text-xs">
          Creating {files.length} file(s)...
        </div>
      ) : (
        <div className="space-y-1">
          <div className="text-[--text-success] text-xs">
            ✓ Files created successfully
          </div>
          {createdFiles.length > 0 && (
            <div className="text-[--text-faint] text-xs">
              {createdFiles.map((path) => (
                <div key={path}>• {path}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
