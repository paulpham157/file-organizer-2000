import React from "react";
import { Copy } from "lucide-react";
import { Notice } from "obsidian";

interface CopyButtonProps {
  content: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ content }) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      new Notice("Copied to clipboard", 2000);
    } catch (error) {
      new Notice(`Failed to copy: ${error instanceof Error ? error.message : "Unknown error"}`, 5000);
    }
  };

  return (
    <button
      onClick={() => { void handleCopy(); }}
      className="p-0.5 rounded outline-none border-none shadow-none bg-transparent hover:shadow-sm transition-shadow flex items-center justify-center w-5 h-5"
      title="Copy to clipboard"
    >
      <Copy size={16} className="text-[--text-muted]" />
    </button>
  );
};
