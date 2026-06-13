import React from "react";
import { ReactRenderer } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from "@tiptap/suggestion";
import type { Instance } from "tippy.js";
import tippy from "tippy.js";
import CommandList from "./command-list";
import {
  Trash2,
  Sparkles,
  Search,
  FileText,
  Zap,
  Video,
  Wand2,
  BookOpen,
  FileCode,
  FilePlus,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: "format" | "action" | "ai";
  command?: string;
  args?: unknown;
  action?: string;
  templateName?: string;
}

interface SlashEditorStorage {
  templates?: string[];
}

type SlashSuggestionProps = SuggestionProps<CommandItem, CommandItem>;

function getTemplateNames(editor: Editor | undefined): string[] {
  if (!editor) return [];
  const storage = editor.storage as SlashEditorStorage;
  const templates = storage.templates;
  return Array.isArray(templates) ? templates : [];
}

// Helper function to get icon for template name
const getTemplateIcon = (templateName: string): React.ReactNode => {
  const lowerName = templateName.toLowerCase();
  if (lowerName.includes("youtube") || lowerName.includes("video")) {
    return <Video className="w-4 h-4" />;
  }
  if (lowerName.includes("enhance")) {
    return <Wand2 className="w-4 h-4" />;
  }
  if (lowerName.includes("meeting")) {
    return <FileText className="w-4 h-4" />;
  }
  if (lowerName.includes("research") || lowerName.includes("paper")) {
    return <BookOpen className="w-4 h-4" />;
  }
  // Default icon for other templates
  return <FileCode className="w-4 h-4" />;
};

// Base commands (action and AI commands)
const baseCommands: CommandItem[] = [
  // Action commands
  {
    id: "clear",
    label: "Clear Chat",
    description: "Clear chat history",
    icon: <Trash2 className="w-4 h-4" />,
    category: "action",
    action: "clear",
  },
  {
    id: "new",
    label: "New Chat",
    description: "Start a new conversation",
    icon: <Sparkles className="w-4 h-4" />,
    category: "action",
    action: "newChat",
  },
  {
    id: "search",
    label: "Search Vault",
    description: "Search your vault",
    icon: <Search className="w-4 h-4" />,
    category: "action",
    action: "search",
  },
  // AI commands
  {
    id: "summarize",
    label: "Summarize",
    description: "Summarize current context",
    icon: <Zap className="w-4 h-4" />,
    category: "ai",
    action: "summarize",
  },
  {
    id: "explain",
    label: "Explain",
    description: "Explain selected text",
    icon: <Zap className="w-4 h-4" />,
    category: "ai",
    action: "explain",
  },
  {
    id: "extract-to-note",
    label: "Extract to new note",
    description: "Turn editor selection into its own linked note",
    icon: <FilePlus className="w-4 h-4" />,
    category: "ai",
    action: "extractToNote",
  },
];

const suggestion = {
  items: ({ query, editor }: { query?: string; editor?: Editor } = {}) => {
    const searchQuery = query || "";
    console.debug("Slash command items requested, query:", searchQuery);

    let templateNames: string[] = [];
    try {
      templateNames = getTemplateNames(editor);
    } catch (error) {
      console.warn("Error accessing editor storage for templates:", error);
      templateNames = [];
    }

    // Create format commands from template names
    const formatCommands: CommandItem[] = templateNames.map((templateName) => ({
      id: `format-${templateName}`,
      label: `Format as ${templateName}`,
      icon: getTemplateIcon(templateName),
      category: "format",
      action: "format",
      templateName: templateName,
    }));

    // Combine all commands
    const allCommands = [...formatCommands, ...baseCommands];

    if (!searchQuery || searchQuery.length === 0) {
      return allCommands;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const filtered = allCommands.filter(
      cmd =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery) ||
        cmd.id.toLowerCase().includes(lowerQuery)
    );
    console.debug("Filtered commands:", filtered.length);
    return filtered;
  },

  render: () => {
    let reactRenderer: ReactRenderer;
    let popup: Instance[];

    return {
      onStart: (props: SlashSuggestionProps) => {
        console.debug("Slash command menu started", props);
        if (!props.clientRect) {
          console.warn("No clientRect provided for slash command");
          return;
        }

        // Create command handler that will be called when item is selected
        const commandHandler = (item: CommandItem) => {
          console.debug("Slash command executed:", item, props);
          const { editor, range } = props;

          // Remove `/query` from the document for every slash pick (same as format).
          // Otherwise the trigger text stays and the chat handler may run with a stale/null editor ref when the menu is clicked.
          if (editor && range) {
            try {
              editor.chain().focus().deleteRange(range).run();
            } catch (error) {
              console.error("Error deleting slash range:", error);
            }
          }

          // Handle format commands - trigger actual formatting (not just insert text)
          if (item.action === "format" && item.templateName) {
            window.setTimeout(() => {
              const event = new CustomEvent("slashCommand", {
                detail: {
                  action: "format",
                  templateName: item.templateName,
                  item,
                  editor,
                },
                bubbles: true,
                cancelable: true,
              });
              activeDocument.dispatchEvent(event);
              console.debug("Dispatched format command event:", item.templateName);
            }, 0);
            return true;
          }

          // Handle action commands (parent listens on document)
          if (item.action) {
            console.debug("Dispatching action command:", item.action);
            window.setTimeout(() => {
              const event = new CustomEvent("slashCommand", {
                detail: { action: item.action, item, editor },
                bubbles: true,
                cancelable: true,
              });
              activeDocument.dispatchEvent(event);
              console.debug("Dispatched slashCommand event:", item.action);
            }, 0);
          }

          return true;
        };

        reactRenderer = new ReactRenderer(CommandList, {
          props: {
            items: props.items,
            command: commandHandler,
          },
          editor: props.editor,
        });

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect,
          appendTo: () => activeDocument.body,
          content: reactRenderer.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
        console.debug("Slash command popup created");
      },

      onUpdate(props: SlashSuggestionProps) {
        if (reactRenderer) {
          reactRenderer.updateProps(props);
        }

        if (!props.clientRect || !popup || !popup[0]) {
          return;
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props: SuggestionKeyDownProps) {
        if (props.event.key === "Escape") {
          if (popup && popup[0]) {
            popup[0].hide();
          }
          return true;
        }

        const commandListRef = reactRenderer?.ref as
          | { onKeyDown?: (args: SuggestionKeyDownProps) => boolean }
          | null;
        return commandListRef?.onKeyDown?.(props) ?? false;
      },

      onExit() {
        if (popup && popup[0]) {
          popup[0].destroy();
        }
        if (reactRenderer) {
          reactRenderer.destroy();
        }
      },

      command: (_props: SlashSuggestionProps) => {
        // This function is called by Tiptap to get the command handler
        // We'll create the handler in onStart where we have access to props
        // For now, return a no-op function - the real handler is set in onStart
        return () => {};
      },
    };
  },
};

export default suggestion;
