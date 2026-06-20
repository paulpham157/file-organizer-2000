import * as React from "react";
import { TFile } from "obsidian";
import FileOrganizer from "../../../index";
import { sanitizeTag } from "../../../someUtils";
import { SkeletonLoader } from "./components/skeleton-loader";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExistingFolderButton,
  NewFolderButton,
} from "./components/suggestion-buttons";
import { logger } from "../../../services/logger";
import {
  isTokenLimitError,
  getTokenLimitErrorMessage,
} from "../../../lib/token-limit-error";
import { useOrganizerFetch } from "../../../lib/use-debounced-fetch";
import {
  buildSuggestionCacheKey,
  getCachedTagSuggestions,
} from "../../../lib/suggestion-cache";

const ExistingTagButton = ExistingFolderButton;
const NewTagButton = NewFolderButton;

interface SimilarTagsProps {
  plugin: FileOrganizer;
  file: TFile | null;
  content: string;
  refreshKey: number;
  onTokenLimitError?: (error: string) => void;
}

export const SimilarTags: React.FC<SimilarTagsProps> = ({
  plugin,
  file,
  content,
  refreshKey,
  onTokenLimitError,
}) => {
  const [existingTags, setExistingTags] = React.useState<
    { tag: string; score: number; reason: string }[]
  >([]);
  const [newTags, setNewTags] = React.useState<
    { tag: string; score: number; reason: string }[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = React.useState(false);
  const requestIdRef = React.useRef(0);
  const tagCountsRef = React.useRef({ existing: 0, new: 0 });
  tagCountsRef.current = {
    existing: existingTags.length,
    new: newTags.length,
  };

  const applyTagSuggestions = React.useCallback(
    (
      suggestedTags: Array<{
        score: number;
        tag: string;
        reason: string;
        isNew: boolean;
      }>
    ) => {
      const existingTagsResult = suggestedTags
        .filter(tag => !tag.isNew)
        .map(tag => ({ tag: tag.tag, score: tag.score, reason: tag.reason }));
      const newTagsResult = suggestedTags
        .filter(tag => tag.isNew)
        .map(tag => ({ tag: tag.tag, score: tag.score, reason: tag.reason }));

      setExistingTags(existingTagsResult);
      setNewTags(newTagsResult);
    },
    []
  );

  const resetForNewFileContext = React.useCallback(() => {
    requestIdRef.current++;

    if (!file || !content) {
      setExistingTags([]);
      setNewTags([]);
      setLoading(false);
      setInitialLoadComplete(false);
      return;
    }

    setExistingTags([]);
    setNewTags([]);
    setLoading(true);
    setInitialLoadComplete(false);

    const cacheKey = buildSuggestionCacheKey(
      file.path,
      content,
      plugin.settings.contentCutoffChars
    );
    const cached = getCachedTagSuggestions(cacheKey);
    if (cached) {
      applyTagSuggestions(cached);
      setLoading(false);
      setInitialLoadComplete(true);
    }
  }, [applyTagSuggestions, content, file, plugin.settings.contentCutoffChars]);

  const fetchTags = React.useCallback(async (signal: AbortSignal) => {
    if (!file || !content) {
      return;
    }

    const requestId = ++requestIdRef.current;
    const cacheKey = buildSuggestionCacheKey(
      file.path,
      content,
      plugin.settings.contentCutoffChars
    );
    const cached = getCachedTagSuggestions(cacheKey);
    if (cached) {
      if (requestId === requestIdRef.current) {
        applyTagSuggestions(cached);
        setLoading(false);
        setInitialLoadComplete(true);
      }
      return;
    }

    const hadSuggestions =
      tagCountsRef.current.existing > 0 || tagCountsRef.current.new > 0;
    if (!hadSuggestions) {
      setLoading(true);
    }

    try {
      const vaultTags = await plugin.getAllVaultTags();
      if (signal.aborted || requestId !== requestIdRef.current) {
        return;
      }

      const suggestedTags = await plugin.recommendTags(
        content,
        file.path,
        vaultTags,
        { signal }
      );

      if (requestId !== requestIdRef.current) {
        return;
      }

      applyTagSuggestions(suggestedTags);
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      logger.error("Error in tag fetching process:", error);

      if (isTokenLimitError(error)) {
        onTokenLimitError?.(getTokenLimitErrorMessage(error));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setInitialLoadComplete(true);
      }
    }
  }, [applyTagSuggestions, content, file, onTokenLimitError, plugin]);

  useOrganizerFetch(
    fetchTags,
    file?.path,
    content,
    refreshKey,
    resetForNewFileContext
  );

  const handleTagClick = (tag: string) => {
    void plugin.appendTag(file, tag);
  };

  const renderContent = () => {
    if (loading && existingTags.length === 0 && newTags.length === 0) {
      return <SkeletonLoader count={4} width="60px" height="24px" rows={1} />;
    }
    if (
      initialLoadComplete &&
      existingTags.length === 0 &&
      newTags.length === 0
    ) {
      return <div className="text-[--text-muted] p-2">No tags found</div>;
    }

    return (
      <motion.div
        className="flex flex-wrap gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <AnimatePresence>
          {existingTags.map((tag, index) => (
            <ExistingTagButton
              key={`existing-${index}`}
              folder={sanitizeTag(tag.tag)}
              onClick={handleTagClick}
              score={tag.score}
              reason={tag.reason}
            />
          ))}
          {newTags.map((tag, index) => (
            <NewTagButton
              key={`new-${index}`}
              folder={sanitizeTag(tag.tag)}
              onClick={handleTagClick}
              score={tag.score}
              reason={tag.reason}
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
