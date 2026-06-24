import { getChatResponsesProviderOptions } from './chat-openai-options';

describe('getChatResponsesProviderOptions', () => {
  const envKey = 'CHAT_REASONING_EFFORT';

  afterEach(() => {
    delete process.env[envKey];
  });

  it('defaults to none', () => {
    expect(getChatResponsesProviderOptions()).toEqual({
      openai: { reasoningEffort: 'none' },
    });
  });

  it('uses valid env value', () => {
    process.env[envKey] = 'low';
    expect(getChatResponsesProviderOptions()).toEqual({
      openai: { reasoningEffort: 'low' },
    });
  });

  it('falls back to none for invalid env value', () => {
    process.env[envKey] = 'turbo';
    expect(getChatResponsesProviderOptions()).toEqual({
      openai: { reasoningEffort: 'none' },
    });
  });
});
