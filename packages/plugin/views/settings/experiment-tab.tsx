import React, { useState, useEffect } from "react";
import FileOrganizer from "../../index";
import { CatalystGate } from "./catalyst-gate";

interface ExperimentTabProps {
  plugin: FileOrganizer;
}

export const ExperimentTab: React.FC<ExperimentTabProps> = ({ plugin }) => {

  const [enableAtomicNotes, setEnableAtomicNotes] = useState(
    plugin.settings.enableAtomicNotes
  );

  const [showLocalLLMInChat, setShowLocalLLMInChat] = useState(
    plugin.settings.showLocalLLMInChat
  );
  const [enableTitleSuggestions, setEnableTitleSuggestions] = useState(
    plugin.settings.enableTitleSuggestions
  );
  const [showSyncTab, setShowSyncTab] = useState(
    plugin.settings.showSyncTab
  );
  const [enableScreenpipe, setEnableScreenpipe] = useState(
    plugin.settings.enableScreenpipe
  );
  const [screenpipeTimeRange, setScreenpipeTimeRange] = useState(
    plugin.settings.screenpipeTimeRange
  );
  const [queryScreenpipeLimit, setQueryScreenpipeLimit] = useState(
    plugin.settings.queryScreenpipeLimit
  );
  const [chatMaxStepsPref, setChatMaxStepsPref] = useState<
    "auto" | "3" | "5"
  >(() => {
    const p = plugin.settings.chatMaxStepsPreference;
    if (p === "auto" || p == null) return "auto";
    return p === 3 ? "3" : "5";
  });

  useEffect(() => {
    setEnableScreenpipe(plugin.settings.enableScreenpipe);
    setScreenpipeTimeRange(plugin.settings.screenpipeTimeRange);
    setQueryScreenpipeLimit(plugin.settings.queryScreenpipeLimit);
  }, [plugin.settings.enableScreenpipe, plugin.settings.screenpipeTimeRange, plugin.settings.queryScreenpipeLimit]);

  const handleToggleChange = async (
    value: boolean,
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    settingKey: keyof typeof plugin.settings
  ) => {
    setter(value);
    (plugin.settings[settingKey] as boolean) = value;
    await plugin.saveSettings();
  };

  return (
    <CatalystGate plugin={plugin}>
      <div className="experiment-settings p-4 space-y-8">
        <div className="mb-8">
          <p className="text-[--text-muted] mb-4">
            These experimental features enhance your File Organizer experience.
            Enable them to:
          </p>
          <ul className="list-disc pl-6 text-[--text-muted] space-y-1 mb-6">
            <li>Generate atomic notes from your content</li>
            <li>Integrate with external tools</li>
            <li>Use AI-powered formatting</li>
          </ul>
          <div className="p-4 bg-[--background-primary-alt] rounded-lg border border-[--background-modifier-border]">
            <p className="text-sm text-[--text-accent]">
              💡 Tip: Start with one experimental feature at a time to better
              understand its impact on your workflow.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-[--text-normal] mb-4">
              Core Experiments
            </h3>
            <div className="space-y-3">
             
              <ToggleSetting
                name="Atomic Notes"
                description="Enable the generation of atomic notes in the assistant sidebar."
                value={enableAtomicNotes}
                onChange={value => {
                  void handleToggleChange(
                    value,
                    setEnableAtomicNotes,
                    "enableAtomicNotes"
                  );
                }}
              />

              <ToggleSetting
                name="Local LLM Integration"
                description={
                  <div className="space-y-2">
                    <p>
                      Enable local LLM options in the chat interface for offline
                      AI processing.
                    </p>
                    <div className="mt-2 p-3 bg-[--background-secondary] rounded text-sm space-y-2">
                      <p className="text-[--text-warning]">
                        ⚡ Requires a compatible local LLM setup
                      </p>
                      <p className="text-[--text-muted]">Currently supports:</p>
                      <ul className="list-disc pl-4 text-[--text-muted]">
                        <li>Any Ollama local model (e.g. Llama 3.2, Deepseek r1)</li>
                      </ul>
                      <p className="text-xs text-[--text-faint]">
                        More models coming soon
                      </p>
                    </div>
                  </div>
                }
                value={showLocalLLMInChat}
                onChange={value => {
                  void handleToggleChange(
                    value,
                    setShowLocalLLMInChat,
                    "showLocalLLMInChat"
                  );
                }}
              />

              <div className="setting-item p-4 bg-[--background-primary] rounded-lg border border-[--background-modifier-border] space-y-2">
                <div className="font-medium text-[--text-normal]">
                  Assistant: tool steps preference
                </div>
                <p className="text-sm text-[--text-muted]">
                  Optional hint for how many tool rounds the cloud chat may run per
                  message. The server always applies your plan limits (e.g. free vs
                  paid) and caps when context is very large. Choose &quot;Auto&quot; to
                  use your tier default only.
                </p>
                <select
                  className="w-full max-w-xs px-2 py-1.5 bg-[--background-primary] border border-[--background-modifier-border] rounded text-[--text-normal]"
                  value={chatMaxStepsPref}
                  onChange={(e) => { void (async (e) => {
                    const v = e.target.value as "auto" | "3" | "5";
                    setChatMaxStepsPref(v);
                    plugin.settings.chatMaxStepsPreference =
                      v === "auto" ? "auto" : (Number(v) as 3 | 5);
                    await plugin.saveSettings();
                  })(e); }}
                >
                  <option value="auto">Auto (plan default)</option>
                  <option value="3">Prefer 3 steps</option>
                  <option value="5">Prefer 5 steps</option>
                </select>
              </div>

              <ToggleSetting
                name="Title Suggestions (Deprecated)"
                description={
                  <div className="space-y-2">
                    <p>Show title suggestions in the sidebar.</p>
                    <div className="mt-2 p-3 bg-[--background-secondary] rounded text-sm space-y-1">
                      <p className="text-[--text-warning]">
                        ⚠️ Deprecated Feature
                      </p>
                      <p className="text-[--text-muted]">
                        This feature will be removed in a future update. For
                        file renaming:
                      </p>
                      <ul className="list-disc pl-4 text-[--text-muted]">
                        <li>
                          Use the rename instructions in Organization
                          preferences
                        </li>
                        <li>
                          Configure file renaming behavior for inbox processing
                        </li>
                      </ul>
                    </div>
                  </div>
                }
                value={enableTitleSuggestions}
                onChange={value => {
                  void handleToggleChange(
                    value,
                    setEnableTitleSuggestions,
                    "enableTitleSuggestions"
                  );
                }}
              />
            </div>
          </div>

          <div className="border-t border-[--background-modifier-border] pt-6">
            <h3 className="text-lg font-medium text-[--text-normal] mb-4">
              Integrations (Beta)
            </h3>
            <div className="bg-[--background-secondary] p-4 rounded-lg mb-4">
              <p className="text-sm text-[--text-muted]">
                These integrations are in early beta. Your feedback helps us
                improve and prioritize features.
              </p>
            </div>

            <div className="space-y-3">


              <div className="space-y-3">
                <ToggleSetting
                  name="Show Sync Tab (Advanced)"
                  description={
                    <div className="space-y-2">
                      <p>Enable the Sync tab in the Assistant sidebar for mobile app file synchronization.</p>
                      <div className="mt-2 p-3 bg-[--background-secondary] rounded text-sm space-y-1">
                        <p className="text-[--text-warning]">
                          ⚠️ Advanced Feature
                        </p>
                        <p className="text-[--text-muted]">
                          This feature is designed for users of the Note Companion mobile app who want to sync files between mobile and desktop.
                        </p>
                        <p className="text-xs text-[--text-faint]">
                          Requires Note Companion mobile app setup
                        </p>
                      </div>
                    </div>
                  }
                  value={showSyncTab}
                  onChange={value => {
                    void handleToggleChange(value, setShowSyncTab, "showSyncTab");
                  }}
                />
                <ToggleSetting
                  name="ScreenPipe Integration"
                  description={
                    <div className="space-y-2">
                      <p>Enable ScreenPipe integration to search your screen activity and audio transcriptions in the AI chat.</p>
                      <div className="mt-2 p-3 bg-[--background-secondary] rounded text-sm space-y-1">
                        <p className="text-[--text-accent]">
                          📺 Requires ScreenPipe running on localhost:3030
                        </p>
                        <p className="text-[--text-muted]">
                          Search your screen recordings and meeting transcriptions directly from chat.
                        </p>
                        <p className="text-xs text-[--text-faint]">
                          Make sure ScreenPipe is running before using this feature
                        </p>
                      </div>
                      {enableScreenpipe && (
                        <div className="mt-4 ml-4 p-4 bg-[--background-primary-alt] rounded-lg border-l-2 border-[--text-accent] space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm text-[--text-normal] font-medium">
                              Time Range (hours)
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                min="1"
                                max="24"
                                value={screenpipeTimeRange}
                                onChange={(e) => { void (async (e) => {
                                  const value = Number(e.target.value);
                                  setScreenpipeTimeRange(value);
                                  plugin.settings.screenpipeTimeRange = value;
                                  await plugin.saveSettings();
                                })(e); }}
                                className="w-20 px-2 py-1 bg-[--background-primary] border border-[--background-modifier-border] rounded"
                              />
                              <span className="text-sm text-[--text-muted]">hours</span>
                            </div>
                            <p className="text-xs text-[--text-muted]">
                              Adjust how far back Screenpipe should look for data. Lower
                              values mean faster processing but may miss important
                              context.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm text-[--text-normal] font-medium">
                              Query Limit
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={queryScreenpipeLimit}
                                onChange={(e) => { void (async (e) => {
                                  const value = Number(e.target.value);
                                  setQueryScreenpipeLimit(value);
                                  plugin.settings.queryScreenpipeLimit = value;
                                  await plugin.saveSettings();
                                })(e); }}
                                className="w-20 px-2 py-1 bg-[--background-primary] border border-[--background-modifier-border] rounded"
                              />
                              <span className="text-sm text-[--text-muted]">items</span>
                            </div>
                            <p className="text-xs text-[--text-muted]">
                              Maximum number of items to fetch per query. Higher limits
                              provide more context but may impact performance.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  }
                  value={enableScreenpipe}
                  onChange={value => {
                    void handleToggleChange(value, setEnableScreenpipe, "enableScreenpipe");
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </CatalystGate>
  );
};

interface ToggleSettingProps {
  name: string;
  description: string | React.JSX.Element;
  value: boolean;
  onChange: (value: boolean) => void;
}

const ToggleSetting: React.FC<ToggleSettingProps> = ({
  name,
  description,
  value,
  onChange,
}) => (
  <div className="setting-item flex items-center justify-between p-4 bg-[--background-primary] rounded-lg border border-[--background-modifier-border] hover:border-[--background-modifier-border-hover]">
    <div className="setting-item-info flex-1">
      <div className="setting-item-name font-medium text-[--text-normal]">
        {name}
      </div>
      <div className="setting-item-description text-sm text-[--text-muted]">
        {description}
      </div>
    </div>
    <div className="setting-item-control">
      <input
        type="checkbox"
        checked={value}
        onChange={e => onChange(e.target.checked)}
        className="text-[--interactive-accent] rounded border-[--background-modifier-border]"
      />
    </div>
  </div>
);
