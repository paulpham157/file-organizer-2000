export const CHAT_PROMPT_HINTS_FULL = {
  includeYoutube: true,
  includeWebFetch: true,
  includeTags: true,
  includeExtractSelection: true,
  includeFormatTemplate: true,
  includeRename: true,
  includeMerge: true,
};

export const computeChatPromptHints = jest.fn(() => ({ ...CHAT_PROMPT_HINTS_FULL }));

export const buildChatSystemPrompt = jest.fn(
  (contextString: string, currentDatetime: string, _hints?: unknown) => {
    return `You are a helpful assistant. Context: ${contextString}. Current time: ${currentDatetime}`;
  }
);

export const getChatSystemPrompt = jest.fn(
  (contextString: string, currentDatetime: string) => {
    return `You are a helpful assistant. Context: ${contextString}. Current time: ${currentDatetime}`;
  }
);
