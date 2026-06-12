import React, { useRef } from "react";
import { TFile } from "obsidian";
import { ToolHandlerProps } from "./types";

interface HeadingsArgs {
  filePaths: string[];
  minLevel?: number;
  maxLevel?: number;
}

export function HeadingsHandler({
  toolInvocation,
  handleAddResult,
  app,
}: ToolHandlerProps) {
  const hasFetchedRef = useRef(false);
  const MAX_HEADINGS_PER_FILE = 250;

  const getHeadings = (
    filePath: string,
    minLevel: number = 1,
    maxLevel: number = 6
  ) => {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      return {
        path: filePath,
        success: false,
        error: "File not found",
      };
    }

    const cache = app.metadataCache.getFileCache(file);
    if (!cache) {
      return {
        path: filePath,
        success: true,
        headings: [],
        totalHeadings: 0,
      };
    }

    const headings =
      cache.headings
        ?.filter((h) => h.level >= minLevel && h.level <= maxLevel)
        .map((h) => ({
          level: h.level,
          heading: h.heading,
          position: {
            start: h.position.start,
            end: h.position.end,
          },
        })) || [];

    const totalHeadingsAll = headings.length;
    const capped =
      headings.length > MAX_HEADINGS_PER_FILE
        ? headings.slice(0, MAX_HEADINGS_PER_FILE)
        : headings;

    return {
      path: filePath,
      success: true,
      headings: capped,
      totalHeadings: totalHeadingsAll,
      headingsTruncated: capped.length < totalHeadingsAll,
    };
  };

  React.useEffect(() => {
    const handleGetHeadings = async () => {
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const { filePaths, minLevel, maxLevel } =
          toolInvocation.args as HeadingsArgs;

        try {
          const results = filePaths.map((path) =>
            getHeadings(path, minLevel ?? 1, maxLevel ?? 6)
          );
          handleAddResult(JSON.stringify(results));
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          handleAddResult(
            JSON.stringify({
              error: `Failed to get headings: ${errorMessage}`,
            })
          );
        }
      }
    };

    void handleGetHeadings();
  }, [toolInvocation, handleAddResult, app]);

  const { filePaths } = toolInvocation.args as HeadingsArgs;
  const isComplete = "result" in toolInvocation;

  return (
    <div className="text-sm">
      {!isComplete ? (
        <div className="text-[--text-muted]">
          Extracting headings from {filePaths.length} file(s)...
        </div>
      ) : (
        <div className="text-[--text-normal]">
          ✓ Headings extracted from {filePaths.length} file(s)
        </div>
      )}
    </div>
  );
}
