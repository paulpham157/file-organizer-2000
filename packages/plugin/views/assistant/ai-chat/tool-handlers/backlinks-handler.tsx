import React, { useRef } from "react";
import { App, TFile } from "obsidian";
import { ToolHandlerProps, getToolArgs } from "./types";

interface BacklinksArgs {
  filePaths: string[];
  includeUnresolved?: boolean;
}

interface BacklinkEntry {
  path: string;
  count: number;
}

interface BacklinkFileResult {
  path: string;
  success: boolean;
  error?: string;
  resolved?: BacklinkEntry[];
  unresolved?: BacklinkEntry[];
  totalResolved?: number;
  totalUnresolved?: number;
  resolvedTruncated?: boolean;
  unresolvedTruncated?: boolean;
  listsTruncated?: boolean;
}

interface MetadataCacheWithBacklinks {
  getBacklinksForFile(file: TFile): Map<string, number> | undefined;
}

/** Obsidian exposes this at runtime but it is not in public MetadataCache typings. */
function getBacklinksForFile(
  metadataCache: App["metadataCache"],
  file: TFile
): Map<string, number> | undefined {
  return (
    metadataCache as unknown as MetadataCacheWithBacklinks
  ).getBacklinksForFile(file);
}

export function BacklinksHandler({
  toolInvocation,
  handleAddResult,
  app,
}: ToolHandlerProps) {
  const hasFetchedRef = useRef(false);
  const MAX_BACKLINK_ROWS = 150;

  const getBacklinks = (
    filePath: string,
    includeUnresolved: boolean
  ): BacklinkFileResult => {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      return {
        path: filePath,
        success: false,
        error: "File not found",
      };
    }

    const backlinksForFile = getBacklinksForFile(app.metadataCache, file);
    const resolved: BacklinkEntry[] = backlinksForFile
      ? Array.from(backlinksForFile.keys()).map((path) => ({
          path,
          count: backlinksForFile.get(path) ?? 0,
        }))
      : [];

    let unresolved: BacklinkEntry[] = [];
    if (includeUnresolved) {
      const unresolvedLinks = app.metadataCache.unresolvedLinks;
      unresolved = Object.entries(unresolvedLinks)
        .filter(([, links]) => filePath in links)
        .map(([path, links]) => ({
          path,
          count: links[filePath],
        }));
    }

    return {
      path: filePath,
      success: true,
      resolved,
      unresolved,
      totalResolved: resolved.length,
      totalUnresolved: unresolved.length,
    };
  };

  React.useEffect(() => {
    const handleGetBacklinks = async () => {
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const { filePaths, includeUnresolved } =
          getToolArgs<BacklinksArgs>(toolInvocation.args);

        try {
          const results = filePaths.map((path) =>
            getBacklinks(path, includeUnresolved ?? false)
          );
          const capped = results.map((r) => {
            if (!r.success) return r;
            const resolved = r.resolved ?? [];
            const unresolved = r.unresolved ?? [];
            const resTrunc = resolved.length > MAX_BACKLINK_ROWS;
            const unresTrunc = unresolved.length > MAX_BACKLINK_ROWS;
            if (!resTrunc && !unresTrunc) return r;
            return {
              ...r,
              resolved: resolved.slice(0, MAX_BACKLINK_ROWS),
              unresolved: unresolved.slice(0, MAX_BACKLINK_ROWS),
              totalResolved: resolved.length,
              totalUnresolved: unresolved.length,
              resolvedTruncated: resTrunc,
              unresolvedTruncated: unresTrunc,
              listsTruncated: resTrunc || unresTrunc,
            };
          });
          handleAddResult(JSON.stringify(capped));
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          handleAddResult(
            JSON.stringify({
              error: `Failed to get backlinks: ${errorMessage}`,
            })
          );
        }
      }
    };

    void handleGetBacklinks();
  }, [toolInvocation, handleAddResult, app]);

  const { filePaths } = getToolArgs<BacklinksArgs>(toolInvocation.args);
  const isComplete = "result" in toolInvocation;

  return (
    <div className="text-sm">
      {!isComplete ? (
        <div className="text-[--text-muted]">
          Finding backlinks for {filePaths.length} file(s)...
        </div>
      ) : (
        <div className="text-[--text-normal]">
          ✓ Backlinks retrieved for {filePaths.length} file(s)
        </div>
      )}
    </div>
  );
}
