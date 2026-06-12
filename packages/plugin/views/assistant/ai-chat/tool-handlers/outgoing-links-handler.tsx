import React, { useRef } from "react";
import { TFile } from "obsidian";
import { ToolHandlerProps } from "./types";

interface OutgoingLinksArgs {
  filePaths: string[];
  includeEmbeds?: boolean;
  resolvedOnly?: boolean;
}

export function OutgoingLinksHandler({
  toolInvocation,
  handleAddResult,
  app,
}: ToolHandlerProps) {
  const hasFetchedRef = useRef(false);
  const MAX_OUTGOING_PER_TYPE = 150;

  const getOutgoingLinks = (
    filePath: string,
    includeEmbeds: boolean,
    resolvedOnly: boolean
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
        links: [],
        embeds: [],
        totalLinks: 0,
        totalEmbeds: 0,
      };
    }

    const links = (cache.links || []).map((link) => ({
      link: link.link,
      displayText: link.displayText,
      resolved: app.metadataCache.getFirstLinkpathDest(link.link, filePath) !== null,
    }));

    const filteredLinks = resolvedOnly
      ? links.filter((l) => l.resolved)
      : links;

    let embeds: Array<{ link: string; displayText?: string; resolved: boolean }> = [];
    if (includeEmbeds) {
      embeds = (cache.embeds || []).map((embed) => ({
        link: embed.link,
        displayText: embed.displayText,
        resolved: app.metadataCache.getFirstLinkpathDest(embed.link, filePath) !== null,
      }));

      if (resolvedOnly) {
        embeds = embeds.filter((e) => e.resolved);
      }
    }

    const totalLinksAll = filteredLinks.length;
    const totalEmbedsAll = embeds.length;
    const linksOut =
      filteredLinks.length > MAX_OUTGOING_PER_TYPE
        ? filteredLinks.slice(0, MAX_OUTGOING_PER_TYPE)
        : filteredLinks;
    const embedsOut =
      embeds.length > MAX_OUTGOING_PER_TYPE
        ? embeds.slice(0, MAX_OUTGOING_PER_TYPE)
        : embeds;

    return {
      path: filePath,
      success: true,
      links: linksOut,
      embeds: embedsOut,
      totalLinks: totalLinksAll,
      totalEmbeds: totalEmbedsAll,
      linksTruncated: linksOut.length < totalLinksAll,
      embedsTruncated: embedsOut.length < totalEmbedsAll,
    };
  };

  React.useEffect(() => {
    const handleGetOutgoingLinks = async () => {
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const { filePaths, includeEmbeds, resolvedOnly } =
          toolInvocation.args as OutgoingLinksArgs;

        try {
          const results = filePaths.map((path) =>
            getOutgoingLinks(
              path,
              includeEmbeds !== false,
              resolvedOnly ?? false
            )
          );
          handleAddResult(JSON.stringify(results));
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          handleAddResult(
            JSON.stringify({
              error: `Failed to get outgoing links: ${errorMessage}`,
            })
          );
        }
      }
    };

    void handleGetOutgoingLinks();
  }, [toolInvocation, handleAddResult, app]);

  const { filePaths } = toolInvocation.args as OutgoingLinksArgs;
  const isComplete = "result" in toolInvocation;

  return (
    <div className="text-sm">
      {!isComplete ? (
        <div className="text-[--text-muted]">
          Analyzing outgoing links for {filePaths.length} file(s)...
        </div>
      ) : (
        <div className="text-[--text-normal]">
          ✓ Outgoing links retrieved for {filePaths.length} file(s)
        </div>
      )}
    </div>
  );
}
