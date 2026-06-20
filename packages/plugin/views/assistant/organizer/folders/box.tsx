import * as React from "react";
import { TFile, Notice } from "obsidian";
import FileOrganizer from "../../../../index";
import { motion, AnimatePresence } from "framer-motion";
import { SkeletonLoader } from "../components/skeleton-loader";
import { FolderSuggestion } from "../../../../index";
import { logMessage } from "../../../../someUtils";
import { ExistingFolderButton, NewFolderButton } from "../components/suggestion-buttons";
import { logger } from "../../../../services/logger";
import {
  getErrorMessage,
  isTokenLimitError,
} from "../../../../lib/api-json";
import { useOrganizerFetch } from "../../../../lib/use-debounced-fetch";
import {
  buildSuggestionCacheKey,
  getCachedFolderSuggestions,
} from "../../../../lib/suggestion-cache";

interface SimilarFolderBoxProps {
  plugin: FileOrganizer;
  file: TFile | null;
  content: string;
  refreshKey: number;
  onTokenLimitError?: (error: string) => void;
}

export const SimilarFolderBox: React.FC<SimilarFolderBoxProps> = ({
  plugin,
  file,
  content,
  refreshKey,
  onTokenLimitError,
}) => {
  const [suggestions, setSuggestions] = React.useState<FolderSuggestion[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [initialLoadComplete, setInitialLoadComplete] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const requestIdRef = React.useRef(0);
  const suggestionsCountRef = React.useRef(0);
  suggestionsCountRef.current = suggestions.length;

  const applyFolderSuggestions = React.useCallback(
    (folderSuggestions: FolderSuggestion[]) => {
      const validFolders = plugin.getAllUserFolders();
      const filteredSuggestions = folderSuggestions.filter(
        suggestion =>
          suggestion.isNewFolder || validFolders.includes(suggestion.folder)
      );
      setSuggestions(filteredSuggestions);
    },
    [plugin]
  );

  const resetForNewFileContext = React.useCallback(() => {
    requestIdRef.current++;
    setError(null);

    if (!file || !content) {
      setSuggestions([]);
      setLoading(false);
      setInitialLoadComplete(false);
      return;
    }

    setSuggestions([]);
    setLoading(true);
    setInitialLoadComplete(false);

    const cacheKey = buildSuggestionCacheKey(
      file.path,
      content,
      plugin.settings.contentCutoffChars
    );
    const cached = getCachedFolderSuggestions(cacheKey);
    if (cached) {
      applyFolderSuggestions(cached);
      setLoading(false);
      setInitialLoadComplete(true);
    }
  }, [
    applyFolderSuggestions,
    content,
    file,
    plugin.settings.contentCutoffChars,
  ]);

  const suggestFolders = React.useCallback(
    async (forceRefresh = false, signal?: AbortSignal) => {
      if (!file || !content) {
        return;
      }

      const requestId = ++requestIdRef.current;
      if (suggestionsCountRef.current === 0) {
        setLoading(true);
      }
      setError(null);

      try {
        const folderSuggestions = await plugin.recommendFolders(
          content,
          file.path,
          forceRefresh ? { forceRefresh: true, signal } : { signal }
        );

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!Array.isArray(folderSuggestions)) {
          logger.error(
            "Error fetching folders: API returned non-array response",
            folderSuggestions
          );
          setError(new Error("Invalid response from server"));
          return;
        }

        applyFolderSuggestions(folderSuggestions);
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        logger.error("Error fetching folders:", err);

        if (isTokenLimitError(err)) {
          const errorMessage =
            err.message ||
            "Token limit exceeded. Please upgrade your plan for more tokens.";
          setError(new Error(errorMessage));
          onTokenLimitError?.(errorMessage);
          return;
        }

        setError(new Error(getErrorMessage(err)));
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setInitialLoadComplete(true);
        }
      }
    },
    [applyFolderSuggestions, content, file, onTokenLimitError, plugin]
  );

  useOrganizerFetch(
    signal => suggestFolders(false, signal),
    file?.path,
    content,
    refreshKey,
    resetForNewFileContext
  );

  const handleRetry = () => {
    void suggestFolders(true);
  };

  const handleFolderClick = async (folder: string) => {
    logMessage({ newFolder: folder, currentFolder: file?.parent?.path });
    if (folder === file?.parent?.path) return;
    if (!file) return;

    setLoading(true);
    try {
      await plugin.moveFile(file, file.basename, folder);
      new Notice(`Moved ${file.basename} to ${folder}`);
    } catch (error) {
      logger.error("Error moving file:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      new Notice(
        `Failed to move ${file.basename} to ${folder}: ${errorMessage}`
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredSuggestions = suggestions.filter(
    s => s.folder !== file?.parent?.path
  );

  const existingFolders = filteredSuggestions.filter(s => !s.isNewFolder);
  const newFolders = filteredSuggestions.filter(s => s.isNewFolder);

  const renderError = () => (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3  border-opacity-20"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[--text-error] font-medium mb-1">
            Error: Failed to fetch
          </div>
          <p className="text-sm text-[--text-muted]">
            {error?.message || "An unexpected error occurred"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <div className="flex gap-2">
          <button
            onClick={handleRetry}
            disabled={loading}
            className="px-3 py-1.5 bg-[--interactive-accent] text-[--text-on-accent] rounded hover:bg-[--interactive-accent-hover] disabled:opacity-50 transition-colors duration-200"
          >
            {loading ? "Retrying..." : "Retry"}
          </button>
          <button
            onClick={() => setError(null)}
            className="px-3 py-1.5 border border-[--background-modifier-border] rounded hover:bg-[--background-modifier-hover] transition-colors duration-200"
          >
            Dismiss
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderContent = () => {
    if (loading && suggestions.length === 0 && !error) {
      return <SkeletonLoader count={4} width="100px" height="30px" rows={1} />;
    }

    if (error) {
      return renderError();
    }

    if (
      initialLoadComplete &&
      existingFolders.length === 0 &&
      newFolders.length === 0
    ) {
      return (
        <div className="text-[--text-muted] p-2">No suitable folders found</div>
      );
    }

    return (
      <motion.div
        className="flex flex-wrap gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <AnimatePresence>
          {existingFolders.map((folder, index) => (
            <ExistingFolderButton
              key={`existing-${index}`}
              folder={folder.folder}
              onClick={() => { void handleFolderClick(folder.folder); }}
              score={folder.score}
              reason={folder.reason}
            />
          ))}
          {newFolders.map((folder, index) => (
            <NewFolderButton
              key={`new-${index}`}
              folder={folder.folder}
              onClick={() => { void handleFolderClick(folder.folder); }}
              score={folder.score}
              reason={folder.reason}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="bg-[--background-primary-alt] text-[--text-normal] p-4 border-b border-[--background-modifier-border]">
      {renderContent()}
    </div>
  );
};
