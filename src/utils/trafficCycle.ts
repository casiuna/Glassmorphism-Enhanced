import type { BillingCycleType } from '@/utils/tagHelper'
import { parseBillingCycleType } from '@/utils/tagHelper'

export interface MonthlyTrafficCycleInput {
  billing_cycle?: number | null
  expired_at?: string | number | null
  traffic_limit?: number | null
}

export interface MonthlyTrafficCycle {
  /** Inclusive UTC start of the active monthly quota window. */
  start: Date
  /** Exclusive UTC start of the next monthly quota window. */
  end: Date
  /** Original renewal day, before short-month clamping. */
  renewalDay: number
  key: string
}

const RECURRING_BILLING_CYCLES = new Set<BillingCycleType>([
  'monthly',
  'quarterly',
  'semi_annual',
  'annual',
  'biennial',
  'triennial',
  'quinquennial',
])

function toValidDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '')
    return null

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function createUtcMonthBoundary(year: number, month: number, renewalDay: number): Date {
  const normalizedMonth = new Date(Date.UTC(year, month, 1))
  const lastDay = new Date(Date.UTC(normalizedMonth.getUTCFullYear(), normalizedMonth.getUTCMonth() + 1, 0)).getUTCDate()
  const day = Math.min(Math.max(renewalDay, 1), lastDay)

  return new Date(Date.UTC(
    normalizedMonth.getUTCFullYear(),
    normalizedMonth.getUTCMonth(),
    day,
  ))
}

/**
 * Resolve the active monthly traffic window from existing renewal metadata.
 *
 * `expired_at` is the next renewal timestamp, so its UTC calendar day is the
 * only renewal-day anchor available to the theme. The billing duration is not
 * used as the traffic duration: recurring annual plans still roll traffic
 * monthly. Boundaries intentionally use UTC midnight so Komari's UTC-aligned
 * rollup buckets cannot contribute data from the previous calendar day.
 */
export function getMonthlyTrafficCycle(
  node: MonthlyTrafficCycleInput,
  now = new Date(),
): MonthlyTrafficCycle | null {
  if (node.traffic_limit !== null && node.traffic_limit !== undefined) {
    const trafficLimit = Number(node.traffic_limit)
    if (!Number.isFinite(trafficLimit) || trafficLimit <= 0)
      return null
  }

  const billingCycle = Number(node.billing_cycle)
  if (!Number.isFinite(billingCycle) || billingCycle <= 0)
    return null

  const billingCycleType = parseBillingCycleType(billingCycle)
  if (!RECURRING_BILLING_CYCLES.has(billingCycleType))
    return null

  const expiry = toValidDate(node.expired_at)
  const current = toValidDate(now)
  if (!expiry || !current)
    return null

  const renewalDay = expiry.getUTCDate()
  const currentBoundary = createUtcMonthBoundary(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    renewalDay,
  )
  const start = currentBoundary.getTime() > current.getTime()
    ? createUtcMonthBoundary(
        current.getUTCFullYear(),
        current.getUTCMonth() - 1,
        renewalDay,
      )
    : currentBoundary
  const end = createUtcMonthBoundary(
    start.getUTCFullYear(),
    start.getUTCMonth() + 1,
    renewalDay,
  )

  return {
    start,
    end,
    renewalDay,
    key: start.toISOString().slice(0, 10),
  }
}
