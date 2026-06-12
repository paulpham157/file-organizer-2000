import React, { useState } from "react";
import { Notice, TFile } from "obsidian";
import { showConfirmModal } from "../../../../lib/show-confirm-modal";
import { ToolHandlerProps, getToolArgs } from "./types";

interface CreateTemplateArgs {
  templateName: string;
  templateContent: string;
  templateFolder?: string;
  description?: string;
  message?: string;
}

export function CreateTemplateHandler({
  toolInvocation,
  handleAddResult,
  app,
}: ToolHandlerProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleConfirmCreate = async () => {
    const {
      templateName,
      templateContent,
      templateFolder = "Templates",
    } = getToolArgs<CreateTemplateArgs>(toolInvocation.args);

    try {
      const folderExists = app.vault.getAbstractFileByPath(templateFolder);
      if (!folderExists) {
        await app.vault.createFolder(templateFolder);
      }

      const templatePath = `${templateFolder}/${templateName}.md`;
      const existingFile = app.vault.getAbstractFileByPath(templatePath);

      if (existingFile instanceof TFile) {
        const confirmOverwrite = await showConfirmModal(app, {
          title: "Overwrite template?",
          message: `Template "${templateName}" already exists. Overwrite?`,
          confirmText: "Overwrite",
        });
        if (!confirmOverwrite) {
          setIsDone(true);
          handleAddResult(
            JSON.stringify({
              success: false,
              message: "User cancelled template creation (already exists)",
            })
          );
          return;
        }
        await app.vault.modify(existingFile, templateContent);
      } else {
        await app.vault.create(templatePath, templateContent);
      }

      setIsDone(true);

      const message = `Created template "${templateName}" in ${templateFolder}/`;

      new Notice(message);

      handleAddResult(
        JSON.stringify({
          success: true,
          templatePath,
          message,
        })
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setIsDone(true);
      new Notice(`Failed to create template: ${errorMessage}`);
      handleAddResult(
        JSON.stringify({
          success: false,
          error: errorMessage,
        })
      );
    }
  };

  const handleCancel = () => {
    setIsDone(true);
    handleAddResult(
      JSON.stringify({
        success: false,
        message: "User cancelled template creation",
      })
    );
  };

  const {
    templateName,
    templateContent,
    description,
    message: reason,
  } = getToolArgs<CreateTemplateArgs>(toolInvocation.args);
  const isComplete = "result" in toolInvocation;

  if (isComplete || isDone) {
    return (
      <div className="text-sm border-b border-[--background-modifier-border] pb-2">
        <div className="text-[--text-success] text-xs">
          {isDone && !isConfirmed
            ? "✗ Template creation cancelled"
            : "✓ Template created"}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 border border-[--background-modifier-border]">
      <div className="flex items-start gap-2">
        <span className="text-[--text-accent] text-lg">📋</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-[--text-normal] mb-1">
            Create Template
          </div>
          <div className="text-xs text-[--text-muted] mb-2">{reason}</div>
        </div>
      </div>

      <div className="text-xs space-y-1">
        <div className="font-semibold text-[--text-muted] uppercase">
          Template Details
        </div>
        <div className="text-[--text-normal] pl-2">
          <strong>Name:</strong> {templateName}
        </div>
        <div className="text-[--text-normal] pl-2">
          <strong>Description:</strong> {description}
        </div>
      </div>

      <div className="text-xs space-y-1">
        <div className="font-semibold text-[--text-muted] uppercase">
          Template Preview
        </div>
        <div className="p-2 bg-[--background-secondary] text-[--text-muted] font-mono text-xs max-h-32 overflow-y-auto whitespace-pre-wrap">
          {templateContent.slice(0, 300)}
          {templateContent.length > 300 && "..."}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          className="flex-1 px-3 py-1.5 text-xs border border-[--background-modifier-border] hover:bg-[--background-modifier-hover] text-[--text-normal]"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            setIsConfirmed(true);
            void handleConfirmCreate();
          }}
          className="flex-1 px-3 py-1.5 text-xs bg-[--interactive-accent] hover:bg-[--interactive-accent-hover] text-white"
        >
          Create Template
        </button>
      </div>
    </div>
  );
}
