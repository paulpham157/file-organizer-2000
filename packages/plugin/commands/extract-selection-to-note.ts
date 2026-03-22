import { App, MarkdownView, normalizePath, TFile } from "obsidian";
import { sanitizeFileName } from "../someUtils";

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

function getUniqueNotePath(
  app: App,
  folder: string,
  stem: string
): string {
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

/**
 * Wikilink to the new note. Prefer path from vault root when in a subfolder
 * so links resolve even if another note shares the same basename.
 */
function wikilinkForPath(vaultRelativePath: string): string {
  const withoutMd = vaultRelativePath.replace(/\.md$/i, "");
  return `[[${withoutMd}]]`;
}

/**
 * Create a new note from the current editor selection in the active file's folder,
 * then replace the selection with a wikilink to the new note.
 */
export async function extractSelectionToNewNote(
  app: App,
  options?: { title?: string }
): Promise<ExtractSelectionResult> {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  if (!view?.editor) {
    return { ok: false, error: "No active markdown editor" };
  }

  const activeFile = app.workspace.getActiveFile();
  if (!activeFile || !(activeFile instanceof TFile) || activeFile.extension !== "md") {
    return { ok: false, error: "No active markdown note" };
  }

  const selectedText = view.editor.getSelection();
  if (!selectedText?.trim()) {
    return { ok: false, error: "No text selected" };
  }

  const folder = activeFile.parent?.path ?? "";

  const fromFirstLine = deriveTitleFromFirstLine(selectedText);
  let requestedStem =
    options?.title?.trim() !== undefined && options.title.trim() !== ""
      ? sanitizeFileName(options.title!.trim()).trim()
      : fromFirstLine;

  if (!requestedStem) {
    requestedStem = fallbackStem();
  }

  const newPath = getUniqueNotePath(app, folder, requestedStem);

  let body = selectedText;
  const usedCustomTitle =
    options?.title?.trim() !== undefined && options.title.trim() !== "";
  if (!usedCustomTitle && fromFirstLine) {
    if (
      normalizeComparable(fromFirstLine) ===
      normalizeComparable(requestedStem)
    ) {
      body = stripFirstLine(selectedText);
    }
  }

  try {
    await app.vault.create(newPath, body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Could not create note: ${msg}` };
  }

  const link = wikilinkForPath(newPath);
  view.editor.replaceSelection(link);

  return { ok: true, newFilePath: newPath, linkInserted: link };
}
