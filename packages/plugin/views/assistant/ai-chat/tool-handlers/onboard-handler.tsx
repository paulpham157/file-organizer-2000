import React, { useState } from "react";
import { TFile } from "obsidian";
import { ToolHandlerProps } from "./types";
import { useContextItems } from "../use-context-items";
import { usePlugin } from "../../provider";

const ONBOARD_MAX_FILES_ROOT = 200;
const ONBOARD_MAX_FILES_NESTED = 100;
const ONBOARD_MAX_SUBFOLDERS_PER_NODE = 40;

interface AnalyzeVaultStructureArgs {
  path?: string;
  maxDepth?: number;
}

interface OnboardNode {
  path: string;
  depth: number;
  files: Array<{ name: string; path: string; type: "file"; depth: number }>;
  subfolders: OnboardNode[];
}

function aggregateVaultScanStats(node: OnboardNode): {
  totalFiles: number;
  fileTypes: Record<string, number>;
} {
  /** Same path appears on parent nodes (whole subtree) and child nodes — count once per file. */
  const seenPaths = new Set<string>();
  const fileTypes: Record<string, number> = {};
  const walk = (n: OnboardNode) => {
    for (const f of n.files) {
      if (seenPaths.has(f.path)) continue;
      seenPaths.add(f.path);
      const ext = f.name.split(".").pop() || "no-extension";
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
    }
    for (const s of n.subfolders || []) walk(s);
  };
  walk(node);
  return { totalFiles: seenPaths.size, fileTypes };
}

function capOnboardStructure(
  node: OnboardNode,
  depth: number
): { capped: OnboardNode; truncated: boolean } {
  let truncated = false;
  const maxFiles =
    depth === 0 ? ONBOARD_MAX_FILES_ROOT : ONBOARD_MAX_FILES_NESTED;
  const origFiles = node.files.length;
  const files = node.files.slice(0, maxFiles);
  if (origFiles > files.length) truncated = true;

  const subs = (node.subfolders || []).slice(0, ONBOARD_MAX_SUBFOLDERS_PER_NODE);
  if ((node.subfolders || []).length > subs.length) truncated = true;

  const cappedSubfolders: OnboardNode[] = [];
  for (const s of subs) {
    const inner = capOnboardStructure(s, depth + 1);
    if (inner.truncated) truncated = true;
    cappedSubfolders.push(inner.capped);
  }

  return {
    capped: {
      ...node,
      files,
      subfolders: cappedSubfolders,
    },
    truncated,
  };
}

export function OnboardHandler({
  toolInvocation,
  handleAddResult,
}: ToolHandlerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toggleLightweightMode } = useContextItems();
  const plugin = usePlugin();

  const getFilesFromPath = (path: string): TFile[] => {
    const allUserFiles = plugin.getAllUserMarkdownFiles();

    if (path === "/") {
      return allUserFiles;
    }

    // Filter files that belong to the specified path
    return allUserFiles.filter(file => {
      const filePath = file.path;
      return filePath.startsWith(path + "/") || filePath === path;
    });
  };

  const analyzeFolderStructure = async (
    path: string,
    depth = 0,
    maxDepth = 3
  ) => {
    toggleLightweightMode();

    const files = getFilesFromPath(path);
    const structure = {
      path,
      files: await Promise.all(
        files.map(async file => {
          const fileData = {
            name: file.name,
            path: file.path,
            type: "file" as const,
            depth: depth + 1,
          };
          return fileData;
        })
      ),
      subfolders: [],
      depth,
    };

    if (depth < maxDepth && path !== "/") {
      // Get all user folders at current path
      const userFolders = plugin.getAllUserFolders().filter(folderPath => {
        // Only include direct subfolders of current path
        const isSubfolder = folderPath.startsWith(path + "/");
        const folderDepth = folderPath.split("/").length;
        const currentDepth = path.split("/").length;
        return isSubfolder && folderDepth === currentDepth + 1;
      });

      // Analyze each subfolder
      for (const folderPath of userFolders) {
        const subStructure = await analyzeFolderStructure(
          folderPath,
          depth + 1,
          maxDepth
        );
        structure.subfolders.push(subStructure);
      }
    }

    return structure;
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    toggleLightweightMode();
    try {
      const { path = "/", maxDepth = 3 } =
        toolInvocation.args as AnalyzeVaultStructureArgs;
      const structure = await analyzeFolderStructure(path, 0, maxDepth);

      const fullStats = aggregateVaultScanStats(structure);
      const { capped, truncated } = capOnboardStructure(structure, 0);
      const analyzedPath =
        typeof path === "string" && path.trim() !== "" ? path.trim() : "/";

      const analysisData = {
        structure: capped,
        stats: {
          totalFiles: fullStats.totalFiles,
          fileTypes: fullStats.fileTypes,
          scannedRootPath: analyzedPath,
          immediateSubfolderCount: capped.subfolders.length,
          maxDepth: maxDepth,
        },
        ...(truncated
          ? {
              truncated: true,
              note:
                analyzedPath === "/"
                  ? "Tree sampled for token limits; totalFiles/fileTypes count each vault note once (deduplicated)."
                  : `Tree sampled for token limits; counts are unique markdown files under "${analyzedPath}" within the scanned depth (deduplicated across parent/child tree nodes).`,
            }
          : {}),
      };

      handleAddResult(JSON.stringify(analysisData));
    } catch (error) {
      console.error("Analysis error:", error);
      handleAddResult(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "An error occurred during analysis",
        })
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-[--text-muted]">
        This will analyze your vault structure to suggest optimal organization
        and settings. The analysis will:
        <ul className="list-disc ml-4 mt-2 space-y-1">
          <li>Scan your folder hierarchy</li>
          <li>Analyze file naming patterns</li>
          <li>Identify common groupings</li>
          <li>Generate recommended settings</li>
        </ul>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => { void handleAnalyze(); }}
          disabled={isAnalyzing}
          className={`
                px-4 py-2 
                ${
                  isAnalyzing
                    ? "bg-[--background-modifier-border] cursor-not-allowed"
                    : "bg-[--interactive-accent] hover:bg-[--interactive-accent-hover]"
                }
                text-[--text-on-accent]
                transition-colors
              `}
        >
          {isAnalyzing ? "Analyzing..." : "Start Analysis"}
        </button>
      </div>
    </div>
  );
}
