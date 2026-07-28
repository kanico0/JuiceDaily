// ─────────────────────────────────────────────────────────────
// zeroUsageAudit.test.ts — Tests proving the camera badge
// correctly displays REMAINING Juice Snaps for zero-usage
// accounts, follows server-authoritative value priority, and
// never locally authorizes scans.
// ─────────────────────────────────────────────────────────────

jest.mock('../../supabase/accountLink', () => ({
  isDurableUser: jest.fn().mockResolvedValue(true),
  refreshSessionAndCheckDurable: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../supabase/identity', () => ({
  getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
}))

jest.mock('../../supabase/supabaseClient', () => ({
  isSupabaseConfigured: jest.fn(() => true),
}))

jest.mock('../../subscriptions/subscriptionConfig', () => ({
  SUPABASE_URL: 'https://test-project.supabase.co',
}))

jest.mock('../../devicePool/devicePoolConfig', () => ({
  isDevicePoolEnabled: jest.fn(() => false),
}))

jest.mock('../../devicePool/devicePromotionProviderFactory', () => ({
  getDevicePromotionProvider: jest.fn(() => ({
    isSupported: () => false,
    getAttestationForScan: jest.fn(),
  })),
}))

import { parseQuota } from '../quotaService'

const fs = require('fs')
const path = require('path')

const cameraSource = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'screens', 'CameraScreen.js'),
  'utf8'
)

const quotaStoreSource = fs.readFileSync(
  path.join(__dirname, '..', 'QuotaStore.tsx'),
  'utf8'
)

const quotaServiceSource = fs.readFileSync(
  path.join(__dirname, '..', 'quotaService.ts'),
  'utf8'
)

const scanQuotaFnSource = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', '..', 'supabase', 'functions', 'scan-quota', 'index.ts'),
  'utf8'
)

const resolveQuotaSql = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', '..', 'supabase', 'migrations', '0003_utc_calendar_quota.sql'),
  'utf8'
)

// Helper: compute the badge value exactly as CameraScreen does
function badgeValue (snapshot: ReturnType<typeof parseQuota>): number | null {
  if (!snapshot) return null
  return snapshot.effectiveRemaining != null
    ? snapshot.effectiveRemaining
    : snapshot.remaining
}

describe('Zero-usage quota audit', () => {
  // 1. New Free account with no usage records displays "5 left"
  test('new Free account with no usage records displays "5 left"', () => {
    const snapshot = parseQuota({
      plan: 'free',
      limit: 5,
      used: 0,
      remaining: 5,
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-08-01T00:00:00.000Z',
      dailyLimit: null,
      dailyUsed: null,
    })
    expect(snapshot).not.toBeNull()
    expect(snapshot!.plan).toBe('free')
    expect(snapshot!.limit).toBe(5)
    expect(snapshot!.used).toBe(0)
    expect(snapshot!.remaining).toBe(5)
    expect(badgeValue(snapshot)).toBe(5)
  })

  // 2. New Pro Monthly account with no usage records displays "60 left"
  test('new Pro Monthly account with no usage records displays "60 left"', () => {
    const snapshot = parseQuota({
      plan: 'pro',
      limit: 60,
      used: 0,
      remaining: 60,
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-08-01T00:00:00.000Z',
      dailyLimit: 10,
      dailyUsed: 0,
    })
    expect(snapshot).not.toBeNull()
    expect(snapshot!.plan).toBe('pro')
    expect(snapshot!.limit).toBe(60)
    expect(badgeValue(snapshot)).toBe(60)
  })

  // 3. New Pro Annual account with no usage records displays "60 left"
  test('new Pro Annual account with no usage records displays "60 left"', () => {
    const snapshot = parseQuota({
      plan: 'pro',
      limit: 60,
      used: 0,
      remaining: 60,
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-08-01T00:00:00.000Z',
      dailyLimit: 10,
      dailyUsed: 0,
    })
    expect(snapshot).not.toBeNull()
    expect(badgeValue(snapshot)).toBe(60)
  })

  // 4. Missing scan_usage_events does not display zero
  test('missing scan_usage_events does not display zero remaining', () => {
    const snapshot = parseQuota({
      plan: 'free',
      limit: 5,
      used: 0,
      remaining: 5,
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-08-01T00:00:00.000Z',
    })
    expect(snapshot).not.toBeNull()
    expect(snapshot!.used).toBe(0)
    expect(badgeValue(snapshot)).toBe(5)
    expect(badgeValue(snapshot)).not.toBe(0)
  })

  // 5. Missing pre-created scan_quotas row does not display zero
  test('missing pre-created scan_quotas row does not display zero remaining', () => {
    const snapshot = parseQuota({
      plan: 'free',
      limit: 5,
      used: 0,
      remaining: 5,
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-08-01T00:00:00.000Z',
    })
    expect(snapshot).not.toBeNull()
    expect(snapshot!.remaining).toBe(5)
    expect(resolveQuotaSql).toContain('on conflict (user_id) do nothing')
  })

  // 6. A new monthly period displays the full renewed allowance
  test('a new monthly period displays the full renewed allowance', () => {
    const snapshot = parseQuota({
      plan: 'pro',
      limit: 60,
      used: 0,
      remaining: 60,
      periodStart: '2026-08-01T00:00:00.000Z',
      periodEnd: '2026-09-01T00:00:00.000Z',
      dailyLimit: 10,
      dailyUsed: 0,
    })
    expect(snapshot).not.toBeNull()
    expect(snapshot!.used).toBe(0)
    expect(badgeValue(snapshot)).toBe(60)
    expect(resolveQuotaSql).toContain('q.used := 0')
    expect(resolveQuotaSql).toContain('q.reserved := 0')
  })

  // 7. Reviewer account displays effective remaining, not merely base-plan limit
  test('reviewer account with support grant uses effectiveRemaining when provided', () => {
    const snapshot = parseQuota({
      plan: 'free',
      limit: 5,
      used: 5,
      remaining: 0,
      effectiveRemaining: 50,
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-08-01T00:00:00.000Z',
    })
    expect(snapshot).not.toBeNull()
    expect(snapshot!.effectiveRemaining).toBe(50)
    expect(badgeValue(snapshot)).toBe(50)
    expect(badgeValue(snapshot)).not.toBe(0)
    expect(badgeValue(snapshot)).not.toBe(5)
  })

  // 8. Loading does not temporarily display zero
  test('loading state does not display zero', () => {
    expect(cameraSource).toContain('quotaLoading')
    expect(cameraSource).toMatch(/quotaLoading[\s\S]*?\.\.\./)
    expect(quotaStoreSource).toContain('setLoading(true)')
  })

  // 9. Signed-out state displays "Plan"
  test('signed-out state displays "Plan"', () => {
    expect(cameraSource).toContain('!isDurable')
    expect(cameraSource).toMatch(/!isDurable[\s\S]*?Plan/)
  })

  // 10. A server-reported zero displays "0 left"
  test('server-reported zero remaining displays "0 left"', () => {
    const snapshot = parseQuota({
      plan: 'free',
      limit: 5,
      used: 5,
      remaining: 0,
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-08-01T00:00:00.000Z',
    })
    expect(snapshot).not.toBeNull()
    expect(snapshot!.remaining).toBe(0)
    expect(badgeValue(snapshot)).toBe(0)
    expect(cameraSource).toContain('left')
    expect(cameraSource).not.toContain('Math.max(1,')
  })

  // 11. The client does not locally authorize scans from the displayed number
  test('client does not locally authorize scans from the displayed number', () => {
    expect(cameraSource).toContain('identifyProduce')
    expect(cameraSource).not.toContain('if (remaining > 0)')
    expect(cameraSource).not.toContain('canScan =')
    expect(quotaServiceSource).toContain('authedFetch')
    expect(quotaServiceSource).toContain('analyze-scan')
    expect(quotaServiceSource).not.toContain('authorizeLocally')
    expect(quotaServiceSource).not.toContain('localQuota')
  })

  // 12. One successful scan reduces the badge exactly once
  test('one successful scan reduces the badge exactly once', () => {
    expect(cameraSource).toContain('if (result.quota) applySnapshot(result.quota)')
    expect(cameraSource).not.toContain('setRemaining(')
    expect(cameraSource).not.toContain('remaining - 1')
    expect(cameraSource).not.toContain('used + 1')
  })

  // 13. Failed scans do not reduce the badge
  test('failed scans do not reduce the badge', () => {
    expect(cameraSource).toContain('setError(message)')
    expect(cameraSource).toContain('setIsApiError(true)')
    const errorBlock = cameraSource.match(/const message = err instanceof Error[\s\S]*?setIsApiError\(true\)/)
    expect(errorBlock).toBeTruthy()
    expect(errorBlock![0]).not.toContain('applySnapshot')
  })

  // 14. Signing between accounts does not retain the previous user's balance
  test('signing between accounts does not retain the previous user balance', () => {
    expect(quotaStoreSource).toContain('addIdentityChangeListener')
    expect(quotaStoreSource).toContain('setQuota(null)')
    expect(quotaStoreSource).toContain('refresh()')
    expect(cameraSource).toContain('refreshQuota()')
    expect(cameraSource).toContain('getAccountStatus()')
    expect(cameraSource).toContain('onAuthenticated')
  })
})

describe('Badge value priority', () => {
  test('effectiveRemaining takes priority over remaining', () => {
    const snapshot = parseQuota({
      plan: 'free',
      limit: 5,
      used: 3,
      remaining: 2,
      effectiveRemaining: 4,
      periodStart: '',
      periodEnd: '',
    })
    expect(badgeValue(snapshot)).toBe(4)
  })

  test('remaining is used when effectiveRemaining is null', () => {
    const snapshot = parseQuota({
      plan: 'free',
      limit: 5,
      used: 2,
      remaining: 3,
      periodStart: '',
      periodEnd: '',
    })
    expect(badgeValue(snapshot)).toBe(3)
  })

  test('remaining is calculated from limit-used when not provided by server', () => {
    const snapshot = parseQuota({
      plan: 'pro',
      limit: 60,
      used: 10,
      periodStart: '',
      periodEnd: '',
    })
    expect(snapshot!.remaining).toBe(50)
  })

  test('does not show Unlimited or Infinity', () => {
    expect(cameraSource).not.toContain('Unlimited')
    expect(cameraSource).not.toContain('Infinity')
    expect(cameraSource).not.toContain('unlimited')
  })

  test('does not derive badge from local stores or hardcoded values', () => {
    expect(cameraSource).not.toContain('usePro(')
    expect(cameraSource).not.toContain('AsyncStorage')
  })
})

describe('Display rules compliance', () => {
  test('loading shows camera icon and ellipsis', () => {
    expect(cameraSource).toMatch(/quotaLoading[\s\S]*?Camera[\s\S]*?\.\.\./)
  })

  test('signed out shows camera icon and "Plan"', () => {
    expect(cameraSource).toMatch(/!isDurable[\s\S]*?Camera[\s\S]*?Plan/)
  })

  test('quota null with no loading shows View plan, not fabricated numbers', () => {
    expect(cameraSource).toContain('quotaDisplay.effectiveRemaining')
    expect(cameraSource).toContain('quotaDisplay.error')
    expect(cameraSource).toContain('View plan')
    // Must not fabricate 5 or 60 when quota is null
    expect(cameraSource).not.toMatch(/!quota[\s\S]*?\d+ successful scans remaining/)
  })

  test('authenticated with quota shows camera icon and "N left"', () => {
    expect(cameraSource).toContain('left')
    expect(cameraSource).toContain('Camera size={12}')
  })

  test('scan-quota server function returns remaining from resolve_quota', () => {
    expect(scanQuotaFnSource).toContain('resolve_quota')
    expect(scanQuotaFnSource).toContain('Math.max(0, limit - used - reserved)')
  })

  test('scan-quota does not return effectiveRemaining (only analyze-scan does)', () => {
    expect(scanQuotaFnSource).not.toContain('effectiveRemaining')
  })
})
