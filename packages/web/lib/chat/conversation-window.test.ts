import {
  DEFAULT_CHAT_MAX_USER_TURNS,
  getChatMaxUserTurnsFromEnv,
  limitMessagesToLastUserTurns,
  summarizeConversationWindow,
} from './conversation-window';

describe('limitMessagesToLastUserTurns', () => {
  const u = (id: string) => ({ role: 'user', id });
  const a = (id: string) => ({ role: 'assistant', id });
  const t = (id: string) => ({ role: 'tool', id });

  it('returns unchanged when maxUserTurns <= 0', () => {
    const msgs = [u('1'), a('2')];
    expect(limitMessagesToLastUserTurns(msgs, 0)).toBe(msgs);
    expect(limitMessagesToLastUserTurns(msgs, -1)).toBe(msgs);
  });

  it('returns unchanged for empty array', () => {
    expect(limitMessagesToLastUserTurns([], 5)).toEqual([]);
  });

  it('returns unchanged when there is no user message', () => {
    const msgs = [a('1'), t('2')];
    expect(limitMessagesToLastUserTurns(msgs, 2)).toEqual(msgs);
  });

  it('returns unchanged when user turns <= K', () => {
    const msgs = [u('1'), a('2'), u('3'), a('4')];
    expect(limitMessagesToLastUserTurns(msgs, 3)).toEqual(msgs);
    expect(limitMessagesToLastUserTurns(msgs, 2)).toEqual(msgs);
  });

  it('drops oldest user turns when user turns > K', () => {
    const msgs = [
      u('u1'),
      a('a1'),
      u('u2'),
      a('a2'),
      u('u3'),
      a('a3'),
    ];
    expect(limitMessagesToLastUserTurns(msgs, 2)).toEqual([
      u('u2'),
      a('a2'),
      u('u3'),
      a('a3'),
    ]);
  });

  it('K=1 keeps only the last turn', () => {
    const msgs = [u('u1'), a('a1'), u('u2'), t('t1'), a('a2')];
    expect(limitMessagesToLastUserTurns(msgs, 1)).toEqual([
      u('u2'),
      t('t1'),
      a('a2'),
    ]);
  });

  it('preserves tool messages in the same turn as the following user anchor', () => {
    const msgs = [
      u('u1'),
      a('a1'),
      u('u2'),
      a('call'),
      t('tr'),
      a('final'),
      u('u3'),
      a('last'),
    ];
    expect(limitMessagesToLastUserTurns(msgs, 2)).toEqual([
      u('u2'),
      a('call'),
      t('tr'),
      a('final'),
      u('u3'),
      a('last'),
    ]);
  });

  it('drops leading non-user messages (e.g. system) when trimming', () => {
    const system = { role: 'system', content: 'sysprompt' };
    const msgs = [system, u('u1'), a('a1'), u('u2'), a('a2')];
    expect(limitMessagesToLastUserTurns(msgs, 1)).toEqual([u('u2'), a('a2')]);
  });

  it('counts consecutive user messages as separate turns', () => {
    const msgs = [u('u1'), u('u2'), a('a2')];
    expect(limitMessagesToLastUserTurns(msgs, 1)).toEqual([u('u2'), a('a2')]);
  });

  it('does not count messages without role as user turns', () => {
    const bare = { id: 'x' };
    const msgs = [bare, u('u1'), a('a1'), u('u2'), a('a2')];
    expect(limitMessagesToLastUserTurns(msgs, 1)).toEqual([u('u2'), a('a2')]);
  });

  it('returns a new array when messages are trimmed', () => {
    const msgs = [u('u1'), a('a1'), u('u2'), a('a2')];
    const out = limitMessagesToLastUserTurns(msgs, 1);
    expect(out).not.toBe(msgs);
    expect(out).toEqual([u('u2'), a('a2')]);
  });

  it('returns the same array reference when already within K user turns', () => {
    const msgs = [u('u1'), a('a1'), u('u2'), a('a2')];
    expect(limitMessagesToLastUserTurns(msgs, 2)).toBe(msgs);
  });
});

describe('summarizeConversationWindow', () => {
  it('reports user turn counts', () => {
    const before = [{ role: 'user' }, { role: 'assistant' }, { role: 'user' }];
    const after = [{ role: 'user' }];
    expect(summarizeConversationWindow(before, after)).toEqual({
      messageCountBefore: 3,
      messageCountAfter: 1,
      originalUserTurns: 2,
      windowedUserTurns: 1,
    });
  });
});

describe('getChatMaxUserTurnsFromEnv', () => {
  const key = 'CHAT_MAX_USER_TURNS';

  afterEach(() => {
    delete process.env[key];
  });

  it('defaults when unset', () => {
    delete process.env[key];
    expect(getChatMaxUserTurnsFromEnv()).toBe(DEFAULT_CHAT_MAX_USER_TURNS);
  });

  it('parses positive integer', () => {
    process.env[key] = '12';
    expect(getChatMaxUserTurnsFromEnv()).toBe(12);
  });

  it('0 means no limit for caller to treat as skip', () => {
    process.env[key] = '0';
    expect(getChatMaxUserTurnsFromEnv()).toBe(0);
  });

  it('negative means no limit', () => {
    process.env[key] = '-1';
    expect(getChatMaxUserTurnsFromEnv()).toBe(-1);
  });

  it('invalid string falls back to default', () => {
    process.env[key] = 'nope';
    expect(getChatMaxUserTurnsFromEnv()).toBe(DEFAULT_CHAT_MAX_USER_TURNS);
  });
});
