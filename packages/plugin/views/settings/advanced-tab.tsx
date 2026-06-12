import React, { useState, useEffect } from "react";
import { Notice } from "obsidian";
import FileOrganizer from "../../index";
import { logger } from "../../services/logger";

interface AdvancedTabProps {
  plugin: FileOrganizer;
}

export const AdvancedTab: React.FC<AdvancedTabProps> = ({ plugin }) => {
  const [enableSelfHosting, setEnableSelfHosting] = useState(
    plugin.settings.enableSelfHosting
  );
  const [selfHostingURL, setSelfHostingURL] = useState(
    plugin.settings.selfHostingURL
  );
  const [useLogs, setUseLogs] = useState(plugin.settings.useLogs);
  const [debugMode, setDebugMode] = useState(plugin.settings.debugMode);
  const [showLogs, setShowLogs] = useState(false);
  const [contentCutoffChars, setContentCutoffChars] = useState(
    plugin.settings.contentCutoffChars
  );
  const [maxFormattingTokens, setMaxFormattingTokens] = useState(
    plugin.settings.maxFormattingTokens
  );
  const [pdfPageLimit, setPdfPageLimit] = useState(
    plugin.settings.pdfPageLimit
  );

  // Sync state with plugin settings when they change
  useEffect(() => {
    setUseLogs(plugin.settings.useLogs);
    setDebugMode(plugin.settings.debugMode);
    setEnableSelfHosting(plugin.settings.enableSelfHosting);
    setSelfHostingURL(plugin.settings.selfHostingURL);
  }, [
    plugin.settings.useLogs,
    plugin.settings.debugMode,
    plugin.settings.enableSelfHosting,
    plugin.settings.selfHostingURL,
  ]);

  const handleToggleChange = async (value: boolean) => {
    setEnableSelfHosting(value);
    plugin.settings.enableSelfHosting = value;
    await plugin.saveSettings();
  };

  const handleURLChange = async (value: string) => {
    setSelfHostingURL(value);
    plugin.settings.selfHostingURL = value;
    await plugin.saveSettings();
  };

  return (
    <div className="p-4 space-y-4">
      <ToggleSetting
        name="Note Companion File Logs"
        description="Allows you to keep track of the changes made by file Organizer."
        value={useLogs}
        onChange={value => {
          setUseLogs(value);
          plugin.settings.useLogs = value;
          void plugin.saveSettings();
        }}
      />

      <ToggleSetting
        name="Debug Mode"
        description="Enable detailed logging for troubleshooting. This may impact performance."
        value={debugMode}
        onChange={value => {
          setDebugMode(value);
          logger.configure(value);
          plugin.settings.debugMode = value;
          void plugin.saveSettings();
        }}
      />

      <div className="setting-item">
        <div className="setting-item-info">
          <div className="setting-item-name">Enable Self-Hosting</div>
          <div className="setting-item-description">
            Enable Self-Hosting to host the server on your own machine. Requires
            technical skills and an external OpenAI API Key + credits. ⛔️ Keep
            disabled if you have a cloud subscription.
          </div>
        </div>
        <div className="setting-item-control">
          <input
            type="checkbox"
            checked={enableSelfHosting}
            onChange={e => { void handleToggleChange(e.target.checked); }}
          />
        </div>
      </div>

      {enableSelfHosting && (
        <div className="setting-item">
          <div className="setting-item-info">
            <div className="setting-item-name">Server URL</div>
          </div>
          <div className="setting-item-control">
            <input
              type="text"
              placeholder="Enter your Server URL"
              value={selfHostingURL}
              onChange={e => { void handleURLChange(e.target.value); }}
            />
          </div>
        </div>
      )}

      {useLogs && (
        <div className="space-y-2 border-t border-[--background-modifier-border] pt-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-[--text-normal]">View Logs</div>
              <div className="text-sm text-[--text-muted]">
                {logger.getLogs().length} log entries available
              </div>
            </div>
            <div className="flex gap-2">
              {logger.getLogs().length > 0 && (
                <>
                  <button
                    onClick={() => { void (async () => {
                      const logs = logger.getLogs();
                      const logText = logs
                        .map(
                          log =>
                            `[${new Date(
                              log.timestamp
                            ).toLocaleString()}] [${log.level.toUpperCase()}] ${
                              log.message
                            }${log.details ? `\n${log.details}` : ""}`
                        )
                        .join("\n\n");
                      try {
                        await navigator.clipboard.writeText(logText);
                        new Notice(
                          `Copied ${logs.length} log entries to clipboard`,
                          2000
                        );
                      } catch (error) {
                        console.error("Failed to copy logs:", error);
                        new Notice("Failed to copy logs to clipboard", 3000);
                      }
                    })(); }}
                    className="clickable-icon"
                    aria-label="Copy all logs"
                    title="Copy all logs to clipboard"
                  >
                    <svg
                      className="w-[--icon-size] h-[--icon-size]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--text-muted)"
                      strokeWidth="2"
                    >
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      logger.clearLogs();
                      setShowLogs(false);
                    }}
                    className="clickable-icon"
                    aria-label="Clear logs"
                    title="Clear all logs"
                  >
                    <svg
                      className="w-[--icon-size] h-[--icon-size]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--text-muted)"
                      strokeWidth="2"
                    >
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </>
              )}
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="clickable-icon"
                aria-label={showLogs ? "Hide logs" : "Show logs"}
                title={showLogs ? "Hide logs" : "Show logs"}
              >
                <svg
                  className="w-[--icon-size] h-[--icon-size]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="2"
                >
                  {showLogs ? (
                    <path d="M18 6L6 18M6 6l12 12" />
                  ) : (
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
                  )}
                </svg>
              </button>
            </div>
          </div>
          {showLogs && (
            <div
              className="max-h-96 overflow-y-auto border border-[--background-modifier-border] rounded p-2 bg-[--background-secondary] select-text"
              style={{ userSelect: "text", WebkitUserSelect: "text" }}
            >
              {logger.getLogs().length === 0 ? (
                <div className="text-sm text-[--text-muted] py-4 text-center">
                  No logs available. Enable Debug Mode to start logging.
                </div>
              ) : (
                logger.getLogs().map((log, index) => (
                  <div
                    key={index}
                    className={`py-1 border-b border-[--background-modifier-border] last:border-0 select-text ${
                      log.level === "error"
                        ? "text-[--text-error]"
                        : log.level === "warn"
                        ? "text-[--text-warning]"
                        : "text-[--text-normal]"
                    }`}
                    style={{ userSelect: "text", WebkitUserSelect: "text" }}
                  >
                    <span className="text-[--text-muted] text-xs">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>{" "}
                    <span className="font-medium">
                      [{log.level.toUpperCase()}]
                    </span>{" "}
                    {log.message}
                    {log.details && (
                      <pre className="text-xs mt-1 text-[--text-muted] whitespace-pre-wrap break-words select-text">
                        {log.details}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div className="setting-item">
        <div className="setting-item-info">
          <div className="setting-item-name">Content Analysis Cutoff</div>
          <div className="setting-item-description">
            Maximum number of characters to analyze for folder suggestions,
            tagging, and titles. Lower values improve performance and reduce API
            costs. Default: 1000
          </div>
        </div>
        <div className="setting-item-control">
          <input
            type="number"
            min="100"
            max="10000"
            value={contentCutoffChars}
            onChange={e => {
              const value = parseInt(e.target.value);
              setContentCutoffChars(value);
              plugin.settings.contentCutoffChars = value;
              void plugin.saveSettings();
            }}
            className="w-24"
          />
        </div>
      </div>

      <div className="setting-item">
        <div className="setting-item-info">
          <div className="setting-item-name">Max Formatting Tokens</div>
          <div className="setting-item-description">
            Maximum number of tokens allowed for document formatting in the
            inbox. Documents exceeding this limit will be skipped. Default:
            100,000
          </div>
        </div>
        <div className="setting-item-control">
          <input
            type="number"
            min="1000"
            max="500000"
            step="1000"
            value={maxFormattingTokens}
            onChange={e => {
              const value = parseInt(e.target.value);
              setMaxFormattingTokens(value);
              plugin.settings.maxFormattingTokens = value;
              void plugin.saveSettings();
            }}
            className="w-24"
          />
        </div>
      </div>

      <div className="setting-item">
        <div className="setting-item-info">
          <div className="setting-item-name">PDF Page Cutoff</div>
          <div className="setting-item-description">
            Maximum number of PDF pages to analyze for context. Default: 10
          </div>
        </div>
        <div className="setting-item-control">
          <input
            type="number"
            min="1"
            max="500"
            value={pdfPageLimit}
            onChange={e => {
              const value = parseInt(e.target.value, 10);
              setPdfPageLimit(value);
              plugin.settings.pdfPageLimit = value;
              void plugin.saveSettings();
            }}
            className="w-24"
          />
        </div>
      </div>
    </div>
  );
};

interface ToggleSettingProps {
  name: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

const ToggleSetting: React.FC<ToggleSettingProps> = ({
  name,
  description,
  value,
  onChange,
}) => (
  <div className="flex items-center justify-between py-2">
    <div>
      <div className="font-medium text-[--text-normal]">{name}</div>
      <div className="text-sm text-[--text-muted]">{description}</div>
    </div>
    <div>
      <input
        type="checkbox"
        checked={value}
        onChange={e => onChange(e.target.checked)}
        className="form-checkbox text-[--interactive-accent]"
      />
    </div>
  </div>
);
