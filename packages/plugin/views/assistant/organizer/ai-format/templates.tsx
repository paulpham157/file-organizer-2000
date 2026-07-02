import * as React from "react";
import { TFile, Notice, normalizePath } from "obsidian";
import FileOrganizer from "../../../../index";
import { UserTemplates } from "./user-templates";
import { DEFAULT_SETTINGS } from "../../../../settings";
import { logger } from "../../../../services/logger";
import { formatNoteWithTemplate } from "../../../../lib/format-with-template";

function resolveBackupFile(
  plugin: FileOrganizer,
  backupPath: string
): TFile | null {
  const normalized = backupPath.replace(/^\//, "");
  const candidates = [
    normalized,
    `${normalized}.md`,
    normalizePath(normalized),
    normalizePath(`${normalized}.md`),
  ];

  for (const candidate of candidates) {
    const file = plugin.app.vault.getAbstractFileByPath(candidate);
    if (file instanceof TFile) {
      return file;
    }
  }

  return null;
}

interface ClassificationBoxProps {
  plugin: FileOrganizer;
  file: TFile | null;
  content: string;
  refreshKey: number;
  onFileRename?: (newFile: TFile) => void;
  onFormatComplete?: (file: TFile) => void;
  onTokenLimitError?: (error: string) => void;
}

export const ClassificationContainer: React.FC<ClassificationBoxProps> = ({
  plugin,
  file,
  content,
  refreshKey,
  onFileRename,
  onFormatComplete,
  onTokenLimitError,
}) => {
  const [formatBehavior, setFormatBehavior] = React.useState<
    "override" | "newFile" | "append"
  >(plugin.settings.formatBehavior || DEFAULT_SETTINGS.formatBehavior);
  const [backupFile, setBackupFile] = React.useState<string | null>(null);

  const handleFormat = async (templateName: string) => {
    if (!file) {
      logger.error("No file selected");
      return;
    }
    try {
      const result = await formatNoteWithTemplate({
        plugin,
        file,
        templateName,
        formatBehavior,
        onFileRename,
      });

      if (result.skipped) {
        if (result.skipReason?.includes("too large")) {
          onTokenLimitError?.(result.skipReason);
        }
        return;
      }

      onFormatComplete?.(result.file);
    } catch (error) {
      logger.error("Error in handleFormat:", error);
      new Notice(
        `Error formatting file: ${
          error instanceof Error ? error.message : String(error)
        }`,
        6000
      );
    }
  };

  const handleRestoreOriginal = async () => {
    if (!file || !backupFile) return;

    try {
      const backupFileRef = resolveBackupFile(plugin, backupFile);
      if (!backupFileRef) {
        throw new Error("Backup file not found");
      }

      const backupContent = await plugin.app.vault.read(backupFileRef);
      await plugin.app.vault.modify(file, backupContent);
      setBackupFile(null);
      new Notice("Restored note from pre-format backup", 3000);
      onFormatComplete?.(file);
    } catch (error) {
      logger.error("Error restoring from backup:", error);
      new Notice("Could not restore the original note", 4000);
    }
  };

  const extractBackupFile = React.useCallback((content: string) => {
    const match = content.match(/\[\[(.+?)\s*\|\s*Link to original file\]\]/);
    if (match) {
      setBackupFile(match[1].trim());
    } else {
      setBackupFile(null);
    }
  }, []);

  React.useEffect(() => {
    if (content) {
      extractBackupFile(content);
    }
  }, [content, extractBackupFile]);

  const handleFormatBehaviorChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newBehavior = event.target.value as "override" | "newFile" | "append";
    setFormatBehavior(newBehavior);
    plugin.settings.formatBehavior = newBehavior;
    await plugin.saveSettings();
  };

  return (
    <div>
      <div className="font-semibold my-3">🗳️ AI Templates</div>
      <div className="bg-[--background-primary-alt] text-[--text-normal] p-4 space-y-4 border-b border-[--background-modifier-border]">
        <div className="flex items-center space-x-2">
          <label htmlFor="formatBehavior" className="font-medium">
            Format Behavior:
          </label>
          <select
            id="formatBehavior"
            value={formatBehavior}
            onChange={(e) => { void handleFormatBehaviorChange(e); }}
            className="px-2 py-1 border border-[--background-modifier-border]"
          >
            <option value="override">Replace</option>
            <option value="newFile">New File</option>
            <option value="append">Append</option>
          </select>
        </div>
        <UserTemplates
          plugin={plugin}
          file={file}
          content={content}
          refreshKey={refreshKey}
          onFormat={handleFormat}
          onTokenLimitError={onTokenLimitError}
          canRestoreOriginal={!!backupFile}
          onRestoreOriginal={() => { void handleRestoreOriginal(); }}
        />
      </div>
    </div>
  );
};
