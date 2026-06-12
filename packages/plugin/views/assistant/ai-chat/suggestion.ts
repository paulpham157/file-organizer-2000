import { ReactRenderer } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from "@tiptap/suggestion";
import type { Instance } from "tippy.js";
import tippy from "tippy.js";
import MentionList from "./mentions";
import Fuse from "fuse.js";

interface MentionItem {
  id?: string;
  title: string;
  content?: string;
  type?: "file" | "tag" | "folder";
  label?: string;
  path?: string;
}

interface MentionStorage {
  files?: MentionItem[];
  tags?: MentionItem[];
  folders?: MentionItem[];
  fullQuery?: string | null;
  visualQuery?: string | null;
}

interface FuseSearchItem extends MentionItem {
  titleNormalized: string;
}

interface ScoredResult {
  item: MentionItem;
  score: number;
}

type MentionListRef = {
  onKeyDown: (args: { event: KeyboardEvent }) => boolean;
};

function getMentionStorage(editor: Editor): MentionStorage {
  const storage = editor.storage as { mention?: MentionStorage };
  return storage.mention ?? {};
}

function ensureMentionStorage(editor: Editor): MentionStorage {
  const storage = editor.storage as { mention?: MentionStorage };
  if (!storage.mention) {
    storage.mention = {};
  }
  return storage.mention;
}

function getResultKey(item: MentionItem): string {
  return item.path ?? item.title ?? item.id ?? "";
}

function toMentionItem(item: FuseSearchItem): MentionItem {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    type: item.type,
    label: item.label,
    path: item.path,
  };
}

const suggestion = {
  items: ({ query, editor }: { query: string; editor: Editor }) => {
    const mentionStorage = getMentionStorage(editor);
    const allFiles = mentionStorage.files ?? [];
    const allTags = mentionStorage.tags ?? [];
    const allFolders = mentionStorage.folders ?? [];

    // Tiptap's suggestion plugin truncates the query at the first space
    // Check if we have a stored full query (with spaces) from onUpdate
    // Note: query may contain underscores (visual) but we search with spaces
    let searchQuery = query;
    if (mentionStorage.fullQuery) {
      searchQuery = mentionStorage.fullQuery;
    } else {
      searchQuery = query.replace(/_/g, " ");
    }

    const allItems: MentionItem[] = [
      ...allFiles,
      ...allTags.slice(0, 3),
      ...allFolders,
    ];

    const itemsWithNormalized: FuseSearchItem[] = allItems.map((item) => ({
      ...item,
      titleNormalized: item.title.replace(/\s+/g, ""),
    }));

    const queryWithoutSpaces = searchQuery.replace(/\s+/g, "");
    const searchQueries = searchQuery.includes(" ")
      ? [searchQuery, queryWithoutSpaces]
      : [searchQuery];

    const fuse = new Fuse(itemsWithNormalized, {
      keys: [
        { name: "title", weight: 1 },
        { name: "titleNormalized", weight: 0.8 },
      ],
      threshold: 0.4,
      includeScore: true,
    });

    const allResults = new Map<string, ScoredResult>();
    for (const q of searchQueries) {
      for (const result of fuse.search(q)) {
        const item = result.item;
        const key = getResultKey(item);
        const cleanItem = toMentionItem(item);

        const existing = allResults.get(key);
        const score = result.score ?? 0;
        if (!existing || existing.score > score) {
          allResults.set(key, {
            item: cleanItem,
            score,
          });
        }
      }
    }

    return Array.from(allResults.values())
      .sort((a, b) => a.score - b.score)
      .slice(0, 10)
      .map((result) => result.item);
  },

  render: () => {
    let reactRenderer: ReactRenderer<MentionListRef>;
    let popup: Instance[];
    let tiptapEditorInstance: Editor | undefined;

    return {
      onStart: (props: SuggestionProps<MentionItem, MentionItem>) => {
        if (!props.clientRect) {
          return;
        }

        tiptapEditorInstance = props.editor;

        reactRenderer = new ReactRenderer(MentionList, {
          props,
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
      },

      onUpdate(props: SuggestionProps<MentionItem, MentionItem>) {
        if (props.range && props.editor) {
          try {
            const { state } = props.editor;
            const { from } = props.range;
            const textAfterTrigger = state.doc.textBetween(
              from,
              state.selection.$from.pos
            );

            const searchQuery = textAfterTrigger.replace(/_/g, " ");

            if (searchQuery !== props.query) {
              const mentionStorage = ensureMentionStorage(props.editor);
              mentionStorage.fullQuery = searchQuery;
              mentionStorage.visualQuery = textAfterTrigger;
              props.query = searchQuery;
            } else {
              const mentionStorage = getMentionStorage(props.editor);
              if (mentionStorage) {
                mentionStorage.fullQuery = null;
                mentionStorage.visualQuery = null;
              }
            }
          } catch {
            // Ignore errors in query extraction
          }
        }

        reactRenderer.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props: SuggestionKeyDownProps) {
        console.debug(
          "[Mention] onKeyDown called, key:",
          props.event.key,
          "code:",
          props.event.code
        );

        if (props.event.key === "Escape") {
          popup[0].hide();
          return true;
        }

        if (props.event.key === " " || props.event.code === "Space") {
          console.debug(
            "[Mention] Space detected, preventing default and inserting underscore"
          );
          props.event.preventDefault();
          props.event.stopPropagation();
          props.event.stopImmediatePropagation();

          const tiptapEditor = tiptapEditorInstance;
          if (!tiptapEditor) {
            console.warn("[Mention] No Tiptap editor available");
            return false;
          }

          let inserted = false;
          if (tiptapEditor.chain) {
            try {
              console.debug(
                "[Mention] Attempting to insert underscore via Tiptap chain API"
              );
              const result = tiptapEditor
                .chain()
                .focus()
                .insertContent("_")
                .run();
              if (result !== false) {
                inserted = true;
                console.debug("[Mention] ✅ Underscore inserted via chain API");
              } else {
                console.warn("[Mention] Chain API returned false");
              }
            } catch (error) {
              console.warn("[Mention] Chain API error:", error);
            }
          }

          if (!inserted) {
            const view = tiptapEditor.view;
            if (view?.state && view.dispatch) {
              try {
                const { state } = view;
                const { $from } = state.selection;
                const pos = $from.pos;

                console.debug(
                  "[Mention] Attempting to insert underscore via transaction at pos:",
                  pos
                );

                const tr = state.tr.insertText("_", pos);
                view.dispatch(tr);

                inserted = true;
                console.debug("[Mention] ✅ Underscore inserted via transaction");
              } catch (error) {
                console.warn("[Mention] Transaction error:", error);
              }
            } else {
              console.warn("[Mention] No view/state/dispatch available", {
                hasEditor: !!tiptapEditor,
                hasView: !!view,
                hasState: !!view?.state,
                hasDispatch: !!view?.dispatch,
                hasChain: !!tiptapEditor.chain,
              });
            }
          }

          if (!inserted) {
            console.warn("[Mention] Could not insert underscore");
            return false;
          }

          const view = tiptapEditor.view;
          if (!view?.state) {
            return true;
          }

          try {
            window.requestAnimationFrame(() => {
              try {
                if (!props.range) return;

                const newState = view.state;
                const { from } = props.range;
                const textAfterTrigger = newState.doc.textBetween(
                  from,
                  newState.selection.$from.pos
                );

                console.debug("[Mention] Text after trigger:", textAfterTrigger);

                const searchQuery = textAfterTrigger.replace(/_/g, " ");

                const mentionStorage = ensureMentionStorage(tiptapEditor);
                mentionStorage.fullQuery = searchQuery;
                mentionStorage.visualQuery = textAfterTrigger;

                console.debug("[Mention] Stored fullQuery:", searchQuery);

                if (reactRenderer) {
                  reactRenderer.updateProps({
                    query: searchQuery,
                    range: {
                      ...props.range,
                      from: props.range.from,
                      to: newState.selection.$from.pos,
                    },
                  });
                  console.debug(
                    "[Mention] Updated suggestion props with query:",
                    searchQuery
                  );
                }
              } catch (error) {
                console.warn(
                  "[Mention] Error updating query with space:",
                  error
                );
              }
            });
          } catch (error) {
            console.error("[Mention] Failed to insert underscore:", error);
            return false;
          }

          return true;
        }

        return reactRenderer.ref?.onKeyDown({ event: props.event }) ?? false;
      },

      onExit() {
        popup[0].destroy();
        reactRenderer.destroy();
      },

      command: (
        props: SuggestionProps<MentionItem, MentionItem>,
        item: MentionItem
      ) => {
        return props.command({
          ...item,
          type: item.type,
          id: item.id ?? item.title,
          label: item.label ?? item.title,
          path: item.path,
        });
      },
    };
  },
};

export default suggestion;
