const CHAT_REASONING_EFFORTS = ['none', 'low', 'medium', 'high'] as const;

type ChatReasoningEffort = (typeof CHAT_REASONING_EFFORTS)[number];

/** OpenAI Responses API options for chat (reasoning models). Default: none — faster, less draft-then-revise. */
export function getChatResponsesProviderOptions(): {
  openai: { reasoningEffort: ChatReasoningEffort };
} {
  const raw = (process.env.CHAT_REASONING_EFFORT || 'none').toLowerCase();
  const effort = CHAT_REASONING_EFFORTS.includes(raw as ChatReasoningEffort)
    ? (raw as ChatReasoningEffort)
    : 'none';
  return { openai: { reasoningEffort: effort } };
}
