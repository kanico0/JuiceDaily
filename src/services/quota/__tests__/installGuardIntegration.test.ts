// ─────────────────────────────────────────────────────────────
// installGuardIntegration.test.ts — Source-level integration tests
// verifying that HomeScreen and QuotaStore correctly wire the
// install-level Free Snap guard into the scan consumption flow.
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

const HOME_SCREEN_PATH = path.resolve(__dirname, '../../../screens/HomeScreen.js')
const QUOTA_STORE_PATH = path.resolve(__dirname, '../QuotaStore.tsx')
const INSTALL_GUARD_PATH = path.resolve(__dirname, '../installFreeSnapGuard.ts')
const STORAGE_PATH = path.resolve(__dirname, '../../storage.ts')
const ACCOUNT_LINK_PATH = path.resolve(__dirname, '../../supabase/accountLink.ts')

const HOME_SCREEN_SRC = fs.readFileSync(HOME_SCREEN_PATH, 'utf-8')
const QUOTA_STORE_SRC = fs.readFileSync(QUOTA_STORE_PATH, 'utf-8')
const INSTALL_GUARD_SRC = fs.readFileSync(INSTALL_GUARD_PATH, 'utf-8')
const STORAGE_SRC = fs.readFileSync(STORAGE_PATH, 'utf-8')
const ACCOUNT_LINK_SRC = fs.readFileSync(ACCOUNT_LINK_PATH, 'utf-8')

describe('Install Free Snap Guard — Source Integration', () => {
  // ── HomeScreen wiring ────────────────────────────────────────
  describe('HomeScreen wiring', () => {
    test('useQuota destructures markInstallSnapConsumed', () => {
      expect(HOME_SCREEN_SRC).toContain('markInstallSnapConsumed')
      // Destructured from useQuota
      const useQuotaLine = HOME_SCREEN_SRC.match(
        /const \{ quota: serverQuota.*\} = useQuota\(\)/,
      )
      expect(useQuotaLine).not.toBeNull()
      expect(useQuotaLine![0]).toContain('markInstallSnapConsumed')
    })

    test('handleProduceIdentified calls markInstallSnapConsumed for Free plan', () => {
      const fnIdx = HOME_SCREEN_SRC.indexOf('const handleProduceIdentified')
      expect(fnIdx).toBeGreaterThan(-1)
      const fnBody = HOME_SCREEN_SRC.slice(fnIdx, fnIdx + 4000)

      // Must call markInstallSnapConsumed
      expect(fnBody).toContain('markInstallSnapConsumed')

      // Must only call it for Free plan (not Pro)
      const markCallIdx = fnBody.indexOf('markInstallSnapConsumed')
      const guardSection = fnBody.slice(markCallIdx - 200, markCallIdx + 100)
      expect(guardSection).toMatch(/plan.*free|free.*plan/)
    })

    test('handleProduceIdentified does NOT call markInstallSnapConsumed unconditionally', () => {
      const fnIdx = HOME_SCREEN_SRC.indexOf('const handleProduceIdentified')
      const fnBody = HOME_SCREEN_SRC.slice(fnIdx, fnIdx + 4000)

      // The call should be inside an if block checking for free plan
      const markIdx = fnBody.indexOf('markInstallSnapConsumed()')
      expect(markIdx).toBeGreaterThan(-1)

      // There should be a plan check before the call
      const beforeCall = fnBody.slice(Math.max(0, markIdx - 300), markIdx)
      expect(beforeCall).toMatch(/quota\.plan.*===.*'free'/)
    })
  })

  // ── QuotaStore wiring ────────────────────────────────────────
  describe('QuotaStore wiring', () => {
    test('imports composeEffectiveQuota and getInstallFreeSnapRemaining', () => {
      expect(QUOTA_STORE_SRC).toContain('composeEffectiveQuota')
      expect(QUOTA_STORE_SRC).toContain('getInstallFreeSnapRemaining')
      expect(QUOTA_STORE_SRC).toContain('markInstallFreeSnapConsumed')
    })

    test('exposes markInstallSnapConsumed in the context value', () => {
      expect(QUOTA_STORE_SRC).toContain('markInstallSnapConsumed')
      // In the interface
      const ifaceMatch = QUOTA_STORE_SRC.match(
        /interface QuotaContextValue \{[\s\S]*?\}/,
      )
      expect(ifaceMatch).not.toBeNull()
      expect(ifaceMatch![0]).toContain('markInstallSnapConsumed')
    })

    test('quota is the effective (composed) quota, not the raw server quota', () => {
      // The useMemo should call composeEffectiveQuota
      expect(QUOTA_STORE_SRC).toContain('composeEffectiveQuota(serverQuota')
    })

    test('refresh returns the effective quota (composed with install guard)', () => {
      const refreshIdx = QUOTA_STORE_SRC.indexOf('const refresh = useCallback')
      const refreshBody = QUOTA_STORE_SRC.slice(refreshIdx, refreshIdx + 2000)
      // Must call getInstallFreeSnapRemaining and composeEffectiveQuota
      expect(refreshBody).toContain('getInstallFreeSnapRemaining')
      expect(refreshBody).toContain('composeEffectiveQuota')
    })

    test('applySnapshot reads install guard for Free plan', () => {
      const applyIdx = QUOTA_STORE_SRC.indexOf('const applySnapshot = useCallback')
      const applyBody = QUOTA_STORE_SRC.slice(applyIdx, applyIdx + 800)
      expect(applyBody).toContain("plan === 'free'")
      expect(applyBody).toContain('getInstallFreeSnapRemaining')
    })

    test('markInstallSnapConsumed only acts on Free plan', () => {
      const markIdx = QUOTA_STORE_SRC.indexOf('const markInstallSnapConsumed = useCallback')
      const markBody = QUOTA_STORE_SRC.slice(markIdx, markIdx + 500)
      expect(markBody).toContain("plan !== 'free'")
    })

    test('identity change listener clears both server quota and install remaining', () => {
      // Find the addIdentityChangeListener call inside useEffect,
      // not the import statement.
      const callIdx = QUOTA_STORE_SRC.indexOf('addIdentityChangeListener(()')
      expect(callIdx).toBeGreaterThan(-1)
      const listenerBody = QUOTA_STORE_SRC.slice(callIdx, callIdx + 300)
      expect(listenerBody).toContain('setServerQuota(null)')
      expect(listenerBody).toContain('setInstallRemaining(null)')
    })

    test('rollback-safe default includes markInstallSnapConsumed', () => {
      const defaultIdx = QUOTA_STORE_SRC.indexOf('Rollback-safe default')
      const defaultBody = QUOTA_STORE_SRC.slice(defaultIdx, defaultIdx + 300)
      expect(defaultBody).toContain('markInstallSnapConsumed')
    })
  })

  // ── installFreeSnapGuard module ──────────────────────────────
  describe('installFreeSnapGuard module', () => {
    test('exports INSTALL_FREE_SNAP_KEY', () => {
      expect(INSTALL_GUARD_SRC).toContain('INSTALL_FREE_SNAP_KEY')
      expect(INSTALL_GUARD_SRC).toContain("@juicing_install_free_snap_v1")
    })

    test('exports getInstallFreeSnapRemaining', () => {
      expect(INSTALL_GUARD_SRC).toContain('export async function getInstallFreeSnapRemaining')
    })

    test('exports markInstallFreeSnapConsumed', () => {
      expect(INSTALL_GUARD_SRC).toContain('export async function markInstallFreeSnapConsumed')
    })

    test('exports composeEffectiveQuota', () => {
      expect(INSTALL_GUARD_SRC).toContain('export function composeEffectiveQuota')
    })

    test('uses AsyncStorage (no hardware identifiers)', () => {
      expect(INSTALL_GUARD_SRC).toContain('AsyncStorage')
      // Must NOT use any hardware identifiers
      expect(INSTALL_GUARD_SRC).not.toMatch(/IMEI|advertisingId|advertising_id|deviceId|device_id|fingerprint/i)
    })

    test('composeEffectiveQuota uses min for Free, bypass for Pro', () => {
      expect(INSTALL_GUARD_SRC).toContain('Math.min')
      expect(INSTALL_GUARD_SRC).toMatch(/plan.*===.*'pro'/)
    })

    test('fail-closed: null installRemaining returns null for Free', () => {
      expect(INSTALL_GUARD_SRC).toContain('installRemaining === null')
    })
  })

  // ── Storage registry ─────────────────────────────────────────
  describe('Storage registry', () => {
    test('ALL_STORAGE_KEYS includes the install free snap key', () => {
      expect(STORAGE_SRC).toContain('@juicing_install_free_snap_v1')
    })
  })

  // ── Device Recall unchanged ──────────────────────────────────
  describe('Device Recall configuration unchanged', () => {
    test('installFreeSnapGuard does not import deviceRecallBits', () => {
      expect(INSTALL_GUARD_SRC).not.toContain('deviceRecallBits')
      expect(INSTALL_GUARD_SRC).not.toContain('deviceRecall')
    })

    test('QuotaStore does not import deviceRecallBits', () => {
      expect(QUOTA_STORE_SRC).not.toContain('deviceRecallBits')
    })
  })

  // ── Self-heal wiring ─────────────────────────────────────────
  describe('Self-heal wiring', () => {
    test('installFreeSnapGuard exports selfHealInstallMarker', () => {
      expect(INSTALL_GUARD_SRC).toContain('export async function selfHealInstallMarker')
    })

    test('selfHealInstallMarker only seeds from exhausted Free quota', () => {
      // Must check plan === 'free'
      expect(INSTALL_GUARD_SRC).toContain("plan !== 'free'")
      // Must check remaining === 0
      expect(INSTALL_GUARD_SRC).toContain('remaining !== 0')
      // Must check used >= 1
      expect(INSTALL_GUARD_SRC).toContain('used < 1')
      // Must check that an anchor can be established (anchorAt or periodStart)
      expect(INSTALL_GUARD_SRC).toContain('getOrCreateInstallAnchor')
    })

    test('selfHealInstallMarker does NOT seed from Pro', () => {
      // The plan check rejects Pro before any write
      expect(INSTALL_GUARD_SRC).toContain("plan !== 'free'")
    })

    test('selfHealInstallMarker does NOT seed from null quota', () => {
      expect(INSTALL_GUARD_SRC).toContain('if (!serverQuota) return false')
    })

    test('QuotaStore imports selfHealInstallMarker', () => {
      expect(QUOTA_STORE_SRC).toContain('selfHealInstallMarker')
    })

    test('QuotaStore refresh calls selfHealInstallMarker for Free plan', () => {
      const refreshIdx = QUOTA_STORE_SRC.indexOf('const refresh = useCallback')
      const refreshBody = QUOTA_STORE_SRC.slice(refreshIdx, refreshIdx + 1500)
      expect(refreshBody).toContain('selfHealInstallMarker')
      // Must be gated on plan === 'free'
      const healIdx = refreshBody.indexOf('selfHealInstallMarker')
      const beforeHeal = refreshBody.slice(Math.max(0, healIdx - 200), healIdx)
      expect(beforeHeal).toMatch(/plan.*===.*'free'/)
    })

    test('QuotaStore applySnapshot calls selfHealInstallMarker for Free plan', () => {
      const applyIdx = QUOTA_STORE_SRC.indexOf('const applySnapshot = useCallback')
      const applyBody = QUOTA_STORE_SRC.slice(applyIdx, applyIdx + 800)
      expect(applyBody).toContain('selfHealInstallMarker')
    })
  })

  // ── Logout safety wiring ─────────────────────────────────────
  describe('Logout safety wiring', () => {
    test('accountLink imports selfHealInstallMarker', () => {
      expect(ACCOUNT_LINK_SRC).toContain('selfHealInstallMarker')
    })

    test('signOutAccount calls persistInstallMarkerBeforeSignOut before signOut', () => {
      const fnIdx = ACCOUNT_LINK_SRC.indexOf('export async function signOutAccount')
      expect(fnIdx).toBeGreaterThan(-1)
      const fnBody = ACCOUNT_LINK_SRC.slice(fnIdx, fnIdx + 1000)

      // persistInstallMarkerBeforeSignOut must be called before signOut
      const healIdx = fnBody.indexOf('persistInstallMarkerBeforeSignOut')
      const signOutIdx = fnBody.indexOf('supabase.auth.signOut')
      expect(healIdx).toBeGreaterThan(-1)
      expect(signOutIdx).toBeGreaterThan(-1)
      expect(healIdx).toBeLessThan(signOutIdx)
    })

    test('persistInstallMarkerBeforeSignOut is best-effort (try/catch)', () => {
      const fnIdx = ACCOUNT_LINK_SRC.indexOf('async function persistInstallMarkerBeforeSignOut')
      const fnBody = ACCOUNT_LINK_SRC.slice(fnIdx, fnIdx + 600)
      expect(fnBody).toContain('catch')
      // Must not throw on failure
      expect(fnBody).toMatch(/Best-effort|do not block/i)
    })

    test('persistInstallMarkerBeforeSignOut checks SUPABASE_CONFIGURED', () => {
      const fnIdx = ACCOUNT_LINK_SRC.indexOf('async function persistInstallMarkerBeforeSignOut')
      const fnBody = ACCOUNT_LINK_SRC.slice(fnIdx, fnIdx + 600)
      expect(fnBody).toContain('SUPABASE_CONFIGURED')
    })

    test('accountLink uses inline parseQuotaMinimal (no circular import)', () => {
      expect(ACCOUNT_LINK_SRC).toContain('parseQuotaMinimal')
      // Must NOT import parseQuota from quotaService (circular)
      expect(ACCOUNT_LINK_SRC).not.toMatch(/import.*parseQuota.*from.*quotaService/)
    })
  })
})
