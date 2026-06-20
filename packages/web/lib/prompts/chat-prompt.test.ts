import {
  buildChatSystemPrompt,
  CHAT_PROMPT_HINTS_FULL,
} from './chat-prompt';

describe('buildChatSystemPrompt temporal guidance', () => {
  it('includes temporal guidance when includeTemporalGuidance is true', () => {
    const prompt = buildChatSystemPrompt('{}', '2025-06-20T12:00:00+00:00', {
      ...CHAT_PROMPT_HINTS_FULL,
      includeTemporalGuidance: true,
    });
    expect(prompt).toContain('### Time, facts, and web search');
    expect(prompt).toContain(
      'use web search before saying information is missing or unknown'
    );
  });

  it('omits temporal guidance by default', () => {
    const prompt = buildChatSystemPrompt(
      '{}',
      '2025-06-20T12:00:00+00:00',
      CHAT_PROMPT_HINTS_FULL
    );
    expect(prompt).not.toContain('### Time, facts, and web search');
  });
});
