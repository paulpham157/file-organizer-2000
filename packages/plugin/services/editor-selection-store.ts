/**
 * Latest frozen editor selection from useEditorSelection (persists when chat steals focus).
 * extractSelectionToNewNote reads this when there is no live selection in the active editor.
 */
export interface FrozenEditorSelectionSnapshot {
  hasSelection: boolean;
  selectedText: string;
  filePath: string | null;
  selection: {
    anchor: { line: number; ch: number };
    head: { line: number; ch: number };
  } | null;
}

let frozen: FrozenEditorSelectionSnapshot | null = null;

export function syncFrozenEditorSelectionForTools(
  ctx: FrozenEditorSelectionSnapshot
): void {
  if (
    ctx.hasSelection &&
    ctx.selectedText?.trim() &&
    ctx.filePath &&
    ctx.selection
  ) {
    frozen = {
      hasSelection: true,
      selectedText: ctx.selectedText,
      filePath: ctx.filePath,
      selection: ctx.selection,
    };
  } else if (!ctx.hasSelection) {
    frozen = null;
  }
}

export function getFrozenEditorSelectionForTools(): FrozenEditorSelectionSnapshot | null {
  return frozen;
}
