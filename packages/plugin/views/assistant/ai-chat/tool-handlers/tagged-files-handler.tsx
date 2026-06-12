import React, { useRef } from "react";
import { TFile } from "obsidian";
import { ToolHandlerProps } from "./types";

interface TaggedFilesArgs {
  tags: string[];
  matchAll?: boolean;
  excludeTags?: string[];
  folder?: string;
}

interface TaggedFileResult {
  path: string;
  name: string;
  tags: string[];
}

export function TaggedFilesHandler({
  toolInvocation,
  handleAddResult,
  app,
}: ToolHandlerProps) {
  const hasFetchedRef = useRef(false);

  const getAllFileTags = (file: TFile): string[] => {
    const cache = app.metadataCache.getFileCache(file);
    if (!cache) return [];

    const tags: string[] = [];

    if (cache.tags) {
      tags.push(...cache.tags.map(t => t.tag.replace(/^#/, "").toLowerCase()));
    }

    if (cache.frontmatter?.tags) {
      const fmTags = Array.isArray(cache.frontmatter.tags)
        ? cache.frontmatter.tags
        : [cache.frontmatter.tags];
      tags.push(
        ...fmTags.map((t: string) => t.replace(/^#/, "").toLowerCase())
      );
    }

    return [...new Set(tags)];
  };

  const findTaggedFiles = (
    tags: string[],
    matchAll: boolean,
    excludeTags?: string[],
    folder?: string
  ): TaggedFileResult[] => {
    const normalizedTags = tags.map(t =>
      t.replace(/^#/, "").toLowerCase()
    );
    const normalizedExclude = excludeTags?.map(t =>
      t.replace(/^#/, "").toLowerCase()
    );

    let files = app.vault.getMarkdownFiles();

    if (folder) {
      const normalizedFolder = folder.endsWith("/") ? folder : `${folder}/`;
      files = files.filter(
        f => f.path === folder || f.path.startsWith(normalizedFolder)
      );
    }

    const results: TaggedFileResult[] = [];

    for (const file of files) {
      const fileTags = getAllFileTags(file);
      if (fileTags.length === 0) continue;

      if (normalizedExclude?.some(et => fileTags.includes(et))) {
        continue;
      }

      const matches = matchAll
        ? normalizedTags.every(t => fileTags.includes(t))
        : normalizedTags.some(t => fileTags.includes(t));

      if (matches) {
        results.push({
          path: file.path,
          name: file.basename,
          tags: fileTags,
        });
      }
    }

    return results;
  };

  React.useEffect(() => {
    const handleGetTaggedFiles = async () => {
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const { tags, matchAll, excludeTags, folder } =
          toolInvocation.args as TaggedFilesArgs;

        try {
          const results = findTaggedFiles(
            tags,
            matchAll ?? false,
            excludeTags,
            folder
          );
          const MAX_FILES = 250;
          const files =
            results.length > MAX_FILES ? results.slice(0, MAX_FILES) : results;
          handleAddResult(
            JSON.stringify({
              success: true,
              matchMode: matchAll ? "AND" : "OR",
              totalMatches: results.length,
              files,
              ...(results.length > MAX_FILES
                ? { filesTruncated: true, filesReturned: MAX_FILES }
                : {}),
            })
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          handleAddResult(
            JSON.stringify({
              error: `Failed to find tagged files: ${errorMessage}`,
            })
          );
        }
      }
    };

    void handleGetTaggedFiles();
  }, [toolInvocation, handleAddResult, app]);

  const { tags } = toolInvocation.args as TaggedFilesArgs;
  const isComplete = "result" in toolInvocation;

  return (
    <div className="text-sm">
      {!isComplete ? (
        <div className="text-[--text-muted]">
          Searching for files tagged{" "}
          {tags.map(t => `#${t}`).join(", ")}...
        </div>
      ) : (
        <div className="text-[--text-normal]">
          ✓ Tag search complete
        </div>
      )}
    </div>
  );
}
