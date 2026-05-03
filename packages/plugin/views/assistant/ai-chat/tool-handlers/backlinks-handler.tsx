import React, { useRef } from "react";
import { App, TFile } from "obsidian";
import { ToolInvocation } from "ai";

interface BacklinksHandlerProps {
  toolInvocation: ToolInvocation;
  handleAddResult: (result: string) => void;
  app: App;
}

export function BacklinksHandler({
  toolInvocation,
  handleAddResult,
  app,
}: BacklinksHandlerProps) {
  const hasFetchedRef = useRef(false);
  const MAX_BACKLINK_ROWS = 150;

  const getBacklinks = (filePath: string, includeUnresolved: boolean) => {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      return {
        path: filePath,
        success: false,
        error: "File not found",
      };
    }

    // Get resolved backlinks
    const backlinksForFile = (app.metadataCache as any).getBacklinksForFile(file);
    const resolved = backlinksForFile
      ? Array.from(backlinksForFile.keys()).map((path: string) => ({
          path,
          count: backlinksForFile.get(path) || 0,
        }))
      : [];

    // Get unresolved backlinks if requested
    let unresolved: Array<{ path: string; count: number }> = [];
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
        const { filePaths, includeUnresolved } = toolInvocation.args;

        try {
          const results = filePaths.map((path: string) =>
            getBacklinks(path, includeUnresolved || false)
          );
          const capped = results.map((r: Record<string, unknown>) => {
            if (typeof r.success === "boolean" && r.success === false) return r;
            const resolved = Array.isArray(r.resolved) ? r.resolved : [];
            const unresolved = Array.isArray(r.unresolved) ? r.unresolved : [];
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
          handleAddResult(
            JSON.stringify({
              error: `Failed to get backlinks: ${error.message}`,
            })
          );
        }
      }
    };

    handleGetBacklinks();
  }, [toolInvocation, handleAddResult, app]);

  const { filePaths } = toolInvocation.args;
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
