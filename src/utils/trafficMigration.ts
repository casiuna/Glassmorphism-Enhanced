import type { MonthlyTrafficCycle } from '@/utils/trafficCycle'

/** Stable production cutover for the v1.0.3 forward-only migration. */
export const V1_0_3_DEFAULT_ROLLOUT_ANCHOR = '2026-09-16T00:00:00.000Z'

/**
 * Vite may replace this with the deterministic visual-test anchor. Production
 * builds use the fixed default above; no browser storage or server write is
 * involved in selecting the cutover.
 */
const injectedRolloutAnchor = typeof __TRAFFIC_MIGRATION_ROLLOUT_ANCHOR__ === 'string'
  ? __TRAFFIC_MIGRATION_ROLLOUT_ANCHOR__
  : ''

export const V1_0_3_ROLLOUT_ANCHOR = injectedRolloutAnchor || V1_0_3_DEFAULT_ROLLOUT_ANCHOR

export function isMonthlyTrafficCycleActive(
  cycle: Pick<MonthlyTrafficCycle, 'start'> | null,
  rolloutAnchor = V1_0_3_ROLLOUT_ANCHOR,
): boolean {
  if (!cycle)
    return false

  const anchorTime = Date.parse(rolloutAnchor)
  return Number.isFinite(anchorTime) && cycle.start.getTime() >= anchorTime
}
