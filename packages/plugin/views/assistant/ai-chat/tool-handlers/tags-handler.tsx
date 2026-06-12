import React, { useRef } from "react";
import { TFile } from "obsidian";
import { ToolHandlerProps } from "./types";

interface TagsArgs {
  filePaths: string[];
  tags: string[];
  location: "frontmatter" | "inline" | "both";
  inlinePosition?: "top" | "bottom";
}

interface TagResult {
  path: string;
  success: boolean;
  error?: string;
  frontmatterUpdated?: boolean;
  inlineUpdated?: boolean;
  tagsAdded?: string[];
}

function normalizeFrontmatterTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags.filter((t): t is string => typeof t === "string");
  }
  if (typeof tags === "string") {
    return [tags];
  }
  return [];
}

export function TagsHandler({
  toolInvocation,
  handleAddResult,
  app,
}: ToolHandlerProps) {
  const hasFetchedRef = useRef(false);

  const addTags = async (
    filePaths: string[],
    tags: string[],
    location: "frontmatter" | "inline" | "both",
    inlinePosition: "top" | "bottom" = "bottom"
  ): Promise<TagResult[]> => {
    const results: TagResult[] = [];

    for (const filePath of filePaths) {
      try {
        const file = app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) {
          results.push({
            path: filePath,
            success: false,
            error: "File not found",
          });
          continue;
        }

        const normalizedTags = tags.map((tag) =>
          tag.startsWith("#") ? tag.slice(1) : tag
        );

        let frontmatterUpdated = false;
        let inlineUpdated = false;

        if (location === "frontmatter" || location === "both") {
          try {
            await app.fileManager.processFrontMatter(
              file,
              (fm: Record<string, unknown>) => {
                const tagsArray = normalizeFrontmatterTags(fm.tags);
                const updatedTags = [
                  ...new Set([...tagsArray, ...normalizedTags]),
                ];
                fm.tags = updatedTags;
              }
            );
            frontmatterUpdated = true;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            results.push({
              path: filePath,
              success: false,
              error: `Failed to update frontmatter: ${errorMessage}`,
            });
            continue;
          }
        }

        if (location === "inline" || location === "both") {
          try {
            const content = await app.vault.read(file);
            const tagLine = normalizedTags.map((tag) => `#${tag}`).join(" ");

            let newContent: string;
            if (inlinePosition === "top") {
              const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n/);
              if (frontmatterMatch) {
                const frontmatter = frontmatterMatch[0];
                const afterFrontmatter = content.slice(frontmatter.length);
                newContent = `${frontmatter}${tagLine}\n\n${afterFrontmatter}`;
              } else {
                newContent = `${tagLine}\n\n${content}`;
              }
            } else {
              newContent = `${content}\n\n${tagLine}`;
            }

            await app.vault.modify(file, newContent);
            inlineUpdated = true;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            results.push({
              path: filePath,
              success: false,
              error: `Failed to add inline tags: ${errorMessage}`,
            });
            continue;
          }
        }

        results.push({
          path: filePath,
          success: true,
          frontmatterUpdated,
          inlineUpdated,
          tagsAdded: normalizedTags,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        results.push({
          path: filePath,
          success: false,
          error: errorMessage,
        });
      }
    }

    return results;
  };

  React.useEffect(() => {
    const handleAddTags = async () => {
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const { filePaths, tags, location, inlinePosition } =
          toolInvocation.args as TagsArgs;

        try {
          const results = await addTags(
            filePaths,
            tags,
            location,
            inlinePosition ?? "bottom"
          );
          handleAddResult(JSON.stringify(results));
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          handleAddResult(
            JSON.stringify({ error: `Failed to add tags: ${errorMessage}` })
          );
        }
      }
    };

    void handleAddTags();
  }, [toolInvocation, handleAddResult, app]);

  const { filePaths, tags, location } = toolInvocation.args as TagsArgs;
  const isComplete = "result" in toolInvocation;

  return (
    <div className="text-sm">
      {!isComplete ? (
        <div className="text-[--text-muted]">
          Adding tags {tags.map((t) => `#${t}`).join(", ")} to{" "}
          {filePaths.length} file(s) in {location}...
        </div>
      ) : (
        <div className="text-[--text-normal]">
          ✓ Tags added to {filePaths.length} file(s)
        </div>
      )}
    </div>
  );
}
