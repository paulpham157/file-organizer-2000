import * as actual from '../../../../lib/chat/chat-max-steps';

/** Avoid real DB in Jest; routes still get deterministic tier (null → free / 3 steps cap). */
export const fetchUserTierForChat = jest.fn().mockResolvedValue(null);

export const getMaxStepsForUserTier = actual.getMaxStepsForUserTier;
export const parseRequestedMaxSteps = actual.parseRequestedMaxSteps;
export const computeEffectiveMaxSteps = actual.computeEffectiveMaxSteps;
export const LARGE_CONTEXT_CHAR_THRESHOLD = actual.LARGE_CONTEXT_CHAR_THRESHOLD;
export const LARGE_CONTEXT_MAX_STEPS = actual.LARGE_CONTEXT_MAX_STEPS;
export const FREE_TIER_MAX_STEPS = actual.FREE_TIER_MAX_STEPS;
export const PAID_TIER_MAX_STEPS = actual.PAID_TIER_MAX_STEPS;
export const MIN_CLIENT_REQUESTED_STEPS = actual.MIN_CLIENT_REQUESTED_STEPS;
export const MAX_CLIENT_REQUESTED_STEPS = actual.MAX_CLIENT_REQUESTED_STEPS;
