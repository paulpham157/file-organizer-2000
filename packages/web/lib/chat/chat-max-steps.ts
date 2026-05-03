import { db, UserUsageTable } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

/** Matches chat route large-context guard */
export const LARGE_CONTEXT_CHAR_THRESHOLD = 100_000;
export const LARGE_CONTEXT_MAX_STEPS = 3;

export const FREE_TIER_MAX_STEPS = 3;
export const PAID_TIER_MAX_STEPS = 5;

export const MIN_CLIENT_REQUESTED_STEPS = 2;
export const MAX_CLIENT_REQUESTED_STEPS = 5;

/**
 * v1 coarse mapping: only `free` (and missing/empty tier) uses the free cap; every other
 * non-empty `UserUsageTable.tier` value gets the paid cap. That assumes the DB stores a
 * small trusted set (e.g. `free`, `paid`). If you add tiers with different limits (`trial`,
 * `enterprise`, …), replace this with an explicit lookup instead of "not free → paid max".
 */
export function getMaxStepsForUserTier(
  tier: string | null | undefined
): number {
  if (tier == null || tier === '' || tier === 'free') {
    return FREE_TIER_MAX_STEPS;
  }
  return PAID_TIER_MAX_STEPS;
}

/**
 * Optional body field from plugin (backward compatible if absent).
 * Invalid values are ignored (treated as undefined).
 */
export function parseRequestedMaxSteps(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  if (!Number.isFinite(n)) {
    return undefined;
  }
  const i = Math.floor(n);
  if (i < MIN_CLIENT_REQUESTED_STEPS || i > MAX_CLIENT_REQUESTED_STEPS) {
    return undefined;
  }
  return i;
}

/**
 * Server formula: min(tier cap, client request if valid, large-context cap).
 */
export function computeEffectiveMaxSteps(params: {
  tierMaxSteps: number;
  requestedMaxSteps?: number;
  contextCharLength: number;
}): number {
  const largeContext =
    params.contextCharLength > LARGE_CONTEXT_CHAR_THRESHOLD;
  const contextCap = largeContext
    ? LARGE_CONTEXT_MAX_STEPS
    : params.tierMaxSteps;
  const requested =
    params.requestedMaxSteps !== undefined
      ? params.requestedMaxSteps
      : params.tierMaxSteps;
  return Math.max(
    1,
    Math.min(params.tierMaxSteps, requested, contextCap)
  );
}

export async function fetchUserTierForChat(
  userId: string
): Promise<string | null> {
  try {
    const rows = await db
      .select({ tier: UserUsageTable.tier })
      .from(UserUsageTable)
      .where(eq(UserUsageTable.userId, userId))
      .limit(1);
    return rows[0]?.tier ?? null;
  } catch (e) {
    console.error('[chat-max-steps] Failed to read user tier:', e);
    return null;
  }
}
