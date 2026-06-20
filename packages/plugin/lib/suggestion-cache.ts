export type CachedFolderSuggestion = {
  isNewFolder: boolean;
  score: number;
  folder: string;
  reason: string;
};

export type TagSuggestionResult = {
  score: number;
  tag: string;
  reason: string;
  isNew: boolean;
};

const MAX_CACHE_ENTRIES = 50;

const folderCache = new Map<string, CachedFolderSuggestion[]>();
const tagCache = new Map<string, TagSuggestionResult[]>();

function touchCacheEntry<V>(cache: Map<string, V>, key: string, value: V): void {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, value);

  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (oldestKey === undefined) {
      break;
    }
    cache.delete(oldestKey);
  }
}

/** Stable cache key from file path and content slice used for AI prompts. */
export function buildSuggestionCacheKey(
  filePath: string,
  content: string,
  contentCutoffChars: number
): string {
  const trimmed = content.slice(0, contentCutoffChars);
  return `${filePath}:${hashString(trimmed)}`;
}

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function getCachedFolderSuggestions(
  key: string
): CachedFolderSuggestion[] | undefined {
  const cached = folderCache.get(key);
  if (cached) {
    folderCache.delete(key);
    folderCache.set(key, cached);
  }
  return cached;
}

export function setCachedFolderSuggestions(
  key: string,
  suggestions: CachedFolderSuggestion[]
): void {
  touchCacheEntry(folderCache, key, suggestions);
}

export function getCachedTagSuggestions(
  key: string
): TagSuggestionResult[] | undefined {
  const cached = tagCache.get(key);
  if (cached) {
    tagCache.delete(key);
    tagCache.set(key, cached);
  }
  return cached;
}

export function setCachedTagSuggestions(
  key: string,
  suggestions: TagSuggestionResult[]
): void {
  touchCacheEntry(tagCache, key, suggestions);
}

export function clearSuggestionCaches(): void {
  folderCache.clear();
  tagCache.clear();
}
