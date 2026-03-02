import React, { useRef } from "react";
import { App } from "obsidian";
import { ToolInvocation } from "ai";

interface BrokenLinksHandlerProps {
  toolInvocation: ToolInvocation;
  handleAddResult: (result: string) => void;
  app: App;
}

interface BySourceEntry {
  sourcePath: string;
  brokenLinks: { link: string; count: number }[];
}

interface ByTargetEntry {
  link: string;
  referencedBy: { sourcePath: string; count: number }[];
}

export function BrokenLinksHandler({
  toolInvocation,
  handleAddResult,
  app,
}: BrokenLinksHandlerProps) {
  const hasFetchedRef = useRef(false);

  const findBrokenLinks = (
    folder: string,
    filePaths: string[],
    groupBySource: boolean,
    limit: number
  ) => {
    const unresolvedLinks = app.metadataCache.unresolvedLinks;

    const hasFileFilter = filePaths.length > 0;
    const filePathSet = hasFileFilter ? new Set(filePaths) : null;
    const folderPrefix = !hasFileFilter && folder
      ? (folder.endsWith("/") ? folder : `${folder}/`)
      : "";

    let totalBrokenLinks = 0;
    const filteredEntries: [string, Record<string, number>][] = [];

    for (const [sourcePath, links] of Object.entries(unresolvedLinks)) {
      if (filePathSet && !filePathSet.has(sourcePath)) {
        continue;
      }
      if (folderPrefix && !sourcePath.startsWith(folderPrefix) && sourcePath !== folder) {
        continue;
      }
      const linkCount = Object.keys(links).length;
      if (linkCount === 0) continue;
      totalBrokenLinks += linkCount;
      filteredEntries.push([sourcePath, links]);
    }

    if (groupBySource) {
      const results: BySourceEntry[] = [];
      let collected = 0;

      for (const [sourcePath, links] of filteredEntries) {
        if (collected >= limit) break;
        const brokenLinks: { link: string; count: number }[] = [];
        for (const [link, count] of Object.entries(links)) {
          if (collected >= limit) break;
          brokenLinks.push({ link, count });
          collected++;
        }
        if (brokenLinks.length > 0) {
          results.push({ sourcePath, brokenLinks });
        }
      }

      return {
        success: true,
        groupedBy: "source" as const,
        totalBrokenLinks,
        showing: collected,
        truncated: collected < totalBrokenLinks,
        results,
      };
    }

    // Group by broken link target
    const targetMap = new Map<string, { sourcePath: string; count: number }[]>();
    let totalEntries = 0;

    for (const [sourcePath, links] of filteredEntries) {
      for (const [link, count] of Object.entries(links)) {
        totalEntries++;
        const existing = targetMap.get(link);
        if (existing) {
          existing.push({ sourcePath, count });
        } else {
          targetMap.set(link, [{ sourcePath, count }]);
        }
      }
    }

    const results: ByTargetEntry[] = [];
    let collected = 0;
    for (const [link, referencedBy] of targetMap) {
      if (collected >= limit) break;
      results.push({ link, referencedBy });
      collected++;
    }

    return {
      success: true,
      groupedBy: "target" as const,
      totalBrokenLinks,
      showing: collected,
      truncated: collected < targetMap.size,
      results,
    };
  };

  React.useEffect(() => {
    const handleFindBrokenLinks = () => {
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const { folder, filePaths, groupBySource, limit } = toolInvocation.args;

        try {
          const results = findBrokenLinks(
            folder || "",
            filePaths || [],
            groupBySource ?? true,
            limit || 100
          );
          handleAddResult(JSON.stringify(results));
        } catch (error) {
          handleAddResult(
            JSON.stringify({
              error: `Failed to find broken links: ${error.message}`,
            })
          );
        }
      }
    };

    handleFindBrokenLinks();
  }, [toolInvocation, handleAddResult, app]);

  const isComplete = "result" in toolInvocation;
  const folder = toolInvocation.args?.folder;
  const filePaths: string[] = toolInvocation.args?.filePaths || [];

  const scopeLabel = filePaths.length > 0
    ? `${filePaths.length} file(s)`
    : folder
      ? `"${folder}"`
      : "vault";

  return (
    <div className="text-sm">
      {!isComplete ? (
        <div className="text-[--text-muted]">
          Scanning {scopeLabel} for broken links...
        </div>
      ) : (
        <div className="text-[--text-normal]">
          ✓ Broken link scan complete
        </div>
      )}
    </div>
  );
}
