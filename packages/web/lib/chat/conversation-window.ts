/**
 * Server-side chat history windowing: keep the last K user turns so long threads
 * do not grow input tokens without bound.
 */

export const DEFAULT_CHAT_MAX_USER_TURNS = 30;

function countUserTurns(messages: unknown[]): number {
  return messages.filter(
    (m) => typeof m === 'object' && m !== null && (m as { role?: string }).role === 'user'
  ).length;
}

/**
 * Keeps messages from the start of the (N - K + 1)-th user turn through the end.
 * Each turn = one user message plus everything until the next user (assistant, tool, …).
 *
 * - If there is no user message, returns messages unchanged.
 * - If maxUserTurns <= 0, caller should not invoke this (no limit).
 */
export function limitMessagesToLastUserTurns(
  messages: unknown[],
  maxUserTurns: number
): unknown[] {
  if (maxUserTurns <= 0 || messages.length === 0) {
    return messages;
  }

  const userIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (typeof m === 'object' && m !== null && (m as { role?: string }).role === 'user') {
      userIndices.push(i);
    }
  }

  if (userIndices.length === 0) {
    return messages;
  }

  if (userIndices.length <= maxUserTurns) {
    return messages;
  }

  const sliceStart = userIndices[userIndices.length - maxUserTurns];
  return messages.slice(sliceStart);
}

/**
 * Read CHAT_MAX_USER_TURNS: unset/invalid → default; 0 or negative → no limit (for debugging).
 */
export function getChatMaxUserTurnsFromEnv(): number {
  const raw = process.env.CHAT_MAX_USER_TURNS;
  if (raw === undefined || raw === '') {
    return DEFAULT_CHAT_MAX_USER_TURNS;
  }
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) {
    return DEFAULT_CHAT_MAX_USER_TURNS;
  }
  return n;
}

export function summarizeConversationWindow(
  before: unknown[],
  after: unknown[]
): {
  messageCountBefore: number;
  messageCountAfter: number;
  originalUserTurns: number;
  windowedUserTurns: number;
} {
  return {
    messageCountBefore: before.length,
    messageCountAfter: after.length,
    originalUserTurns: countUserTurns(before),
    windowedUserTurns: countUserTurns(after),
  };
}
