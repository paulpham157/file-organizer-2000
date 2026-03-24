import { App, EditorPosition, MarkdownView, normalizePath, TFile } from "obsidian";
import { sanitizeFileName } from "../someUtils";
import { getFrozenEditorSelectionForTools } from "../services/editor-selection-store";

export type ExtractSelectionResult =
  | { ok: true; newFilePath: string; linkInserted: string }
  | { ok: false; error: string };

function normalizeComparable(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** First line of markdown, stripped of leading # and list markers. */
function lineToPlainTitle(line: string): string {
  let s = line.trim();
  s = s.replace(/^#{1,6}\s*/, "");
  s = s.replace(/^[-*+]\s+(\[[ x]\]\s*)?/i, "");
  s = s.replace(/^\d+\.\s+/, "");
  return s.trim();
}

function deriveTitleFromFirstLine(selection: string): string {
  const firstLine = selection.split("\n")[0] ?? "";
  const plain = lineToPlainTitle(firstLine);
  const sanitized = sanitizeFileName(plain).trim();
  return sanitized.replace(/\s+/g, " ").trim();
}

function fallbackStem(): string {
  return `Extracted note ${Date.now()}`;
}

function stripFirstLine(text: string): string {
  const idx = text.indexOf("\n");
  if (idx === -1) return "";
  return text.slice(idx + 1).replace(/^\n+/, "");
}

function getUniqueNotePath(app: App, folder: string, stem: string): string {
  const base = stem.trim() || fallbackStem();
  const tryPath = (name: string) =>
    folder ? normalizePath(`${folder}/${name}.md`) : normalizePath(`${name}.md`);

  let candidate = tryPath(base);
  if (!app.vault.getAbstractFileByPath(candidate)) {
    return candidate;
  }
  for (let n = 2; n < 1000; n++) {
    const withSuffix = `${base} - ${n}`;
    candidate = tryPath(withSuffix);
    if (!app.vault.getAbstractFileByPath(candidate)) {
      return candidate;
    }
  }
  return tryPath(`${base} - ${Date.now()}`);
}

function wikilinkForPath(vaultRelativePath: string): string {
  const withoutMd = vaultRelativePath.replace(/\.md$/i, "");
  return `[[${withoutMd}]]`;
}

/** Map Obsidian line/ch positions to absolute offsets in file text (vault.read). */
function editorRangeToOffsets(
  doc: string,
  anchor: EditorPosition,
  head: EditorPosition
): { start: number; end: number } {
  const lines = doc.split(/\r?\n/);
  const posToOffset = (pos: EditorPosition) => {
    let o = 0;
    for (let i = 0; i < pos.line && i < lines.length; i++) {
      o += lines[i].length + 1;
    }
    const lineText = lines[pos.line] ?? "";
    o += Math.min(pos.ch, lineText.length);
    return o;
  };
  const a = posToOffset(anchor);
  const b = posToOffset(head);
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

type ExtractSource =
  | {
      mode: "live";
      view: MarkdownView;
      file: TFile;
      selectedText: string;
    }
  | {
      mode: "frozen";
      file: TFile;
      selectedText: string;
      replaceStart: number;
      replaceEnd: number;
    };

/**
 * Create a new note from the current editor selection (or frozen chat selection),
 * then replace that range with a wikilink.
 */
export async function extractSelectionToNewNote(
  app: App,
  options?: { title?: string }
): Promise<ExtractSelectionResult> {
  let source: ExtractSource | undefined;

  const view = app.workspace.getActiveViewOfType(MarkdownView);
  const liveFile = view?.file;
  if (
    view?.editor &&
    liveFile instanceof TFile &&
    liveFile.extension === "md"
  ) {
    const live = view.editor.getSelection();
    if (live?.trim()) {
      source = { mode: "live", view, file: liveFile, selectedText: live };
    }
  }

  if (!source) {
    const snap = getFrozenEditorSelectionForTools();
    if (
      !snap?.hasSelection ||
      !snap.selectedText?.trim() ||
      !snap.filePath ||
      !snap.selection
    ) {
      return {
        ok: false,
        error:
          "No text selected in the note. Select text before running extract; the chat Selection chip shows what will be used when the note is not focused.",
      };
    }

    const file = app.vault.getAbstractFileByPath(snap.filePath);
    if (!file || !(file instanceof TFile) || file.extension !== "md") {
      return {
        ok: false,
        error:
          "Could not find the source note for your saved selection. Select text in the note again.",
      };
    }

    const doc = await app.vault.read(file);
    const { start, end } = editorRangeToOffsets(
      doc,
      snap.selection.anchor,
      snap.selection.head
    );
    const slice = doc.slice(start, end);
    if (slice !== snap.selectedText) {
      if (slice.replace(/\r\n/g, "\n") !== snap.selectedText.replace(/\r\n/g, "\n")) {
        return {
          ok: false,
          error:
            "The note changed since you selected that text. Open the note and select the block again.",
        };
      }
    }

    source = {
      mode: "frozen",
      file,
      selectedText: snap.selectedText,
      replaceStart: start,
      replaceEnd: end,
    };
  }

  const selectedText = source.selectedText;
  const folder = source.file.parent?.path ?? "";

  const fromFirstLine = deriveTitleFromFirstLine(selectedText);
  const titleArg = options?.title?.trim();
  const useExplicitTitle = titleArg !== undefined && titleArg !== "";

  let requestedStem = useExplicitTitle
    ? sanitizeFileName(titleArg).trim()
    : fromFirstLine;

  if (!requestedStem) {
    requestedStem = fallbackStem();
  }

  const newPath = getUniqueNotePath(app, folder, requestedStem);

  let body = selectedText;
  if (!useExplicitTitle && fromFirstLine) {
    if (
      normalizeComparable(fromFirstLine) ===
      normalizeComparable(requestedStem)
    ) {
      body = stripFirstLine(selectedText);
    }
  }

  const link = wikilinkForPath(newPath);

  try {
    await app.vault.create(newPath, body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Could not create note: ${msg}` };
  }

  try {
    if (source.mode === "live") {
      source.view.editor.replaceSelection(link);
    } else {
      const doc = await app.vault.read(source.file);
      const newDoc =
        doc.slice(0, source.replaceStart) +
        link +
        doc.slice(source.replaceEnd);
      await app.vault.modify(source.file, newDoc);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `Note was created but replacing the selection failed: ${msg}. New file: ${newPath}`,
    };
  }

  return { ok: true, newFilePath: newPath, linkInserted: link };
}
