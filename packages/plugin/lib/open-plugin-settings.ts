import { App } from "obsidian";

type ObsidianSettingManager = {
  open: () => void;
  openTabById: (pluginId: string) => void;
};

type AppWithSettings = App & {
  setting: ObsidianSettingManager;
};

export function openPluginSettings(app: App, pluginId: string): void {
  const setting = (app as AppWithSettings).setting;
  setting.open();
  setting.openTabById(pluginId);
}
