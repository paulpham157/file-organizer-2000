import {
  FREE_TIER_MAX_STEPS,
  LARGE_CONTEXT_CHAR_THRESHOLD,
  LARGE_CONTEXT_MAX_STEPS,
  PAID_TIER_MAX_STEPS,
  computeEffectiveMaxSteps,
  getMaxStepsForUserTier,
  parseRequestedMaxSteps,
} from './chat-max-steps';
import {
  isChatDeepSearchEnabled,
  isChatWebSearchEnabled,
} from './chat-web-search';

describe('isChatWebSearchEnabled', () => {
  const webSearchKey = 'CHAT_WEB_SEARCH';
  const deepSearchKey = 'CHAT_DEEP_SEARCH';

  afterEach(() => {
    delete process.env[webSearchKey];
    delete process.env[deepSearchKey];
  });

  it('defaults to true when unset', () => {
    expect(isChatWebSearchEnabled()).toBe(true);
  });

  it('returns false when CHAT_WEB_SEARCH=false', () => {
    process.env[webSearchKey] = 'false';
    expect(isChatWebSearchEnabled()).toBe(false);
  });
});

describe('isChatDeepSearchEnabled', () => {
  const deepSearchKey = 'CHAT_DEEP_SEARCH';

  afterEach(() => {
    delete process.env[deepSearchKey];
  });

  it('defaults to false when unset', () => {
    expect(isChatDeepSearchEnabled()).toBe(false);
  });

  it('returns true when CHAT_DEEP_SEARCH=true', () => {
    process.env[deepSearchKey] = 'true';
    expect(isChatDeepSearchEnabled()).toBe(true);
  });
});

describe('getMaxStepsForUserTier', () => {
  it('returns free cap for null, empty, or free', () => {
    expect(getMaxStepsForUserTier(null)).toBe(FREE_TIER_MAX_STEPS);
    expect(getMaxStepsForUserTier(undefined)).toBe(FREE_TIER_MAX_STEPS);
    expect(getMaxStepsForUserTier('')).toBe(FREE_TIER_MAX_STEPS);
    expect(getMaxStepsForUserTier('free')).toBe(FREE_TIER_MAX_STEPS);
  });

  it('returns paid cap for any other tier string', () => {
    expect(getMaxStepsForUserTier('paid')).toBe(PAID_TIER_MAX_STEPS);
    expect(getMaxStepsForUserTier('pro')).toBe(PAID_TIER_MAX_STEPS);
  });
});

describe('parseRequestedMaxSteps', () => {
  it('returns undefined for missing or invalid', () => {
    expect(parseRequestedMaxSteps(undefined)).toBeUndefined();
    expect(parseRequestedMaxSteps(null)).toBeUndefined();
    expect(parseRequestedMaxSteps('')).toBeUndefined();
    expect(parseRequestedMaxSteps(1)).toBeUndefined();
    expect(parseRequestedMaxSteps(6)).toBeUndefined();
    expect(parseRequestedMaxSteps(NaN)).toBeUndefined();
  });

  it('accepts integers 2–5', () => {
    expect(parseRequestedMaxSteps(2)).toBe(2);
    expect(parseRequestedMaxSteps(5)).toBe(5);
    expect(parseRequestedMaxSteps('4')).toBe(4);
    expect(parseRequestedMaxSteps(4.7)).toBe(4);
  });
});

describe('computeEffectiveMaxSteps', () => {
  it('caps by tier and large context', () => {
    const smallCtx = LARGE_CONTEXT_CHAR_THRESHOLD;
    const largeCtx = LARGE_CONTEXT_CHAR_THRESHOLD + 1;

    expect(
      computeEffectiveMaxSteps({
        tierMaxSteps: PAID_TIER_MAX_STEPS,
        contextCharLength: smallCtx,
      })
    ).toBe(PAID_TIER_MAX_STEPS);

    expect(
      computeEffectiveMaxSteps({
        tierMaxSteps: PAID_TIER_MAX_STEPS,
        contextCharLength: largeCtx,
      })
    ).toBe(LARGE_CONTEXT_MAX_STEPS);
  });

  it('clamps requested steps to tier and context', () => {
    expect(
      computeEffectiveMaxSteps({
        tierMaxSteps: FREE_TIER_MAX_STEPS,
        requestedMaxSteps: 5,
        contextCharLength: 0,
      })
    ).toBe(FREE_TIER_MAX_STEPS);

    expect(
      computeEffectiveMaxSteps({
        tierMaxSteps: PAID_TIER_MAX_STEPS,
        requestedMaxSteps: 3,
        contextCharLength: 0,
      })
    ).toBe(3);
  });

  it('applies large context cap even when tier is high', () => {
    expect(
      computeEffectiveMaxSteps({
        tierMaxSteps: PAID_TIER_MAX_STEPS,
        requestedMaxSteps: 5,
        contextCharLength: LARGE_CONTEXT_CHAR_THRESHOLD + 1,
      })
    ).toBe(LARGE_CONTEXT_MAX_STEPS);
  });
});
