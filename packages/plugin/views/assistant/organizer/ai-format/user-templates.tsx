import * as React from "react";
import { TFile } from "obsidian";
import FileOrganizer from "../../../../index";
import { logMessage } from "../../../../someUtils";
import { logger } from "../../../../services/logger";
import {
  cleanup,
  getTokenCount,
  initializeTokenCounter,
} from "../../../../utils/token-counter";
import {
  isTokenLimitError,
  getTokenLimitErrorMessage,
} from "../../../../lib/token-limit-error";
import {
  ORGANIZER_SECONDARY_DELAY_MS,
  useOrganizerFetch,
} from "../../../../lib/use-debounced-fetch";

interface UserTemplatesProps {
  plugin: FileOrganizer;
  file: TFile | null;
  content: string;
  refreshKey: number;
  onFormat: (templateName: string) => void;
  onTokenLimitError?: (error: string) => void;
}

export const UserTemplates: React.FC<UserTemplatesProps> = ({
  plugin,
  file,
  content,
  refreshKey,
  onFormat,
  onTokenLimitError,
}) => {
  const [templateNames, setTemplateNames] = React.useState<string[]>([]);
  const [selectedTemplateName, setSelectedTemplateName] = React.useState<
    string | null
  >(null);
  const [showDropdown, setShowDropdown] = React.useState<boolean>(false);
  const [formatting, setFormatting] = React.useState<boolean>(false);
  const [contentLoadStatus, setContentLoadStatus] = React.useState<
    "loading" | "success" | "error"
  >("loading");
  const [classificationStatus, setClassificationStatus] = React.useState<
    "loading" | "success" | "error"
  >("loading");
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [isFileTooLarge, setIsFileTooLarge] = React.useState<boolean>(false);
  const requestIdRef = React.useRef(0);

  React.useEffect(() => {
    if (content && file) {
      setContentLoadStatus("success");
    } else {
      setContentLoadStatus("error");
    }
  }, [content, file]);

  React.useEffect(() => {
    let isMounted = true;

    const checkTokenCount = async () => {
      try {
        await initializeTokenCounter();
        if (isMounted) {
          const tokenCount = getTokenCount(content);
          setIsFileTooLarge(tokenCount > 128000);
        }
      } catch (error) {
        console.error("Error checking token count:", error);
      }
    };

    void checkTokenCount();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [content]);

  const resetForNewFileContext = React.useCallback(() => {
    requestIdRef.current++;
    setSelectedTemplateName(null);
    setClassificationStatus("loading");
  }, []);

  const fetchClassification = React.useCallback(
    async (signal: AbortSignal) => {
      if (!content || !file) {
        setClassificationStatus("error");
        return;
      }

      const requestId = ++requestIdRef.current;
      setClassificationStatus("loading");

      try {
        const fetchedTemplateNames = await plugin.getTemplateNames();
        if (signal.aborted || requestId !== requestIdRef.current) {
          return;
        }
        setTemplateNames(fetchedTemplateNames);
        logMessage(fetchedTemplateNames, "fetchedTemplateNames");

        const classifiedAs = await plugin.classifyContentV2(
          content,
          fetchedTemplateNames,
          { signal }
        );
        if (signal.aborted || requestId !== requestIdRef.current) {
          return;
        }
        logMessage(classifiedAs, "classifiedAs");

        const selectedClassification = fetchedTemplateNames.find(
          t => t.toLowerCase() === classifiedAs?.toLowerCase()
        );
        if (selectedClassification) {
          setSelectedTemplateName(selectedClassification);
        } else {
          console.warn(
            "No matching classification found, using empty classification"
          );
          setSelectedTemplateName(null);
        }
        setClassificationStatus("success");
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        logger.error("Error in fetchClassification:", error);

        if (isTokenLimitError(error)) {
          onTokenLimitError?.(getTokenLimitErrorMessage(error));
        }

        setClassificationStatus("error");
      }
    },
    [content, file, onTokenLimitError, plugin]
  );

  useOrganizerFetch(
    fetchClassification,
    file?.path,
    content,
    refreshKey,
    resetForNewFileContext,
    600,
    ORGANIZER_SECONDARY_DELAY_MS
  );

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    activeDocument.addEventListener("mousedown", handleClickOutside);
    return () => {
      activeDocument.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getDisplayText = () => {
    if (selectedTemplateName) {
      return `Format as ${selectedTemplateName}`;
    }
    return "Select template";
  };

  const dropdownTemplates = templateNames.filter(
    t => t !== selectedTemplateName
  );

  const handleFormatClick = async () => {
    if (selectedTemplateName) {
      setFormatting(true);
      try {
        onFormat(selectedTemplateName);
      } catch (error) {
        logger.error("Error formatting:", error);
      } finally {
        setFormatting(false);
      }
    }
  };

  const renderContent = () => {
    if (contentLoadStatus === "error" || classificationStatus === "error") {
      return (
        <div className="text-[--text-error] p-2 bg-[--background-modifier-error]">
          Unable to process the content. Please try again later.
        </div>
      );
    }
    if (classificationStatus === "loading") {
      return (
        <div className="text-[--text-muted] p-2">Classifying content...</div>
      );
    }

    return (
      <div className="flex flex-col space-y-2">
        <div className="relative" ref={dropdownRef}>
          <button
            className="w-full flex items-center justify-between px-3 py-2 bg-[--background-secondary] text-[--text-normal] hover:bg-[--background-modifier-hover] transition-colors duration-200"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <span>{getDisplayText()}</span>
            <svg
              className="w-4 h-4 ml-2"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 9L12 15L18 9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {showDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-[--background-primary] border border-[--background-modifier-border]">
              {dropdownTemplates.length > 0 ? (
                dropdownTemplates.map((templateName, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 cursor-pointer hover:bg-[--background-modifier-hover] text-[--text-normal]"
                    onClick={() => {
                      setSelectedTemplateName(templateName);
                      setShowDropdown(false);
                    }}
                  >
                    {templateName}
                  </div>
                ))
              ) : (
                <div className="px-3 py-2 text-[--text-muted]">
                  No templates available
                </div>
              )}
            </div>
          )}
        </div>
        {isFileTooLarge && (
          <div className="text-[--text-error] p-2 bg-[--background-modifier-error]">
            File is too large to format.
          </div>
        )}
        <button
          className={`px-4 py-2 transition-colors duration-200 flex items-center justify-center ${
            !selectedTemplateName || formatting
              ? "bg-[--background-modifier-border] text-[--text-muted] cursor-not-allowed"
              : "bg-[--interactive-accent] text-white hover:bg-[--interactive-accent-hover]"
          }`}
          disabled={!selectedTemplateName || formatting || isFileTooLarge}
          onClick={() => { void handleFormatClick(); }}
        >
          {formatting ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Applying...
            </span>
          ) : (
            "Apply"
          )}
        </button>
      </div>
    );
  };

  return <div className="">{renderContent()}</div>;
};
