export const MAX_TAGS_FOR_AI = 50;
export const MAX_FOLDERS_FOR_AI = 100;

/** Top tags by frequency (caller should pass pre-sorted list). */
export function capTagsForAI(
  tags: string[],
  max: number = MAX_TAGS_FOR_AI
): string[] {
  return tags.slice(0, max);
}

/**
 * Prefer parent chain and shallow folders before filling from the full list.
 * Keeps LLM prompts small on large vaults without dropping the current location.
 */
export function prioritizeFoldersForAI(
  allFolders: string[],
  filePath: string,
  max: number = MAX_FOLDERS_FOR_AI
): string[] {
  if (allFolders.length <= max) {
    return allFolders;
  }

  const folderSet = new Set(allFolders);
  const prioritized: string[] = [];
  const seen = new Set<string>();

  const add = (folder: string) => {
    if (seen.has(folder) || !folderSet.has(folder)) {
      return;
    }
    seen.add(folder);
    prioritized.push(folder);
  };

  let parent = filePath.includes("/")
    ? filePath.slice(0, filePath.lastIndexOf("/"))
    : "";
  while (parent) {
    add(parent);
    const idx = parent.lastIndexOf("/");
    parent = idx >= 0 ? parent.slice(0, idx) : "";
  }

  for (const folder of allFolders) {
    if (prioritized.length >= max) {
      break;
    }
    if (folder.split("/").length <= 2) {
      add(folder);
    }
  }

  for (const folder of allFolders) {
    if (prioritized.length >= max) {
      break;
    }
    add(folder);
  }

  return prioritized.slice(0, max);
}
