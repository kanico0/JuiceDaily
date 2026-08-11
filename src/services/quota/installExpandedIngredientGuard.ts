// ─────────────────────────────────────────────────────────────
// installExpandedIngredientGuard.ts — Same-install lifetime guard
// for the three Free Expanded Ingredient Analyses.
//
// PRODUCT POLICY:
//   1–4 qualifying ingredients: free/unlimited
//   5+ qualifying ingredients:
//     Free = 3 complimentary lifetime analyses
//     Pro  = unlimited
//
// This guard prevents the cross-account reset loophole:
//   1. Free user A uses 1 analysis → 2/3 remaining
//   2. Logout → new anonymous UUID → server reports 3/3 (fresh row)
//   3. Without this guard, UI shows 3/3 (wrong)
//   4. With this guard, UI shows 2/3 (correct — same install)
//
// The guard stores a lifetime `used` count (0–3) in AsyncStorage,
// independent of Supabase UUID. It is NOT keyed to any account.
//
// ATOMIC PERSISTED STATE:
//   A single AsyncStorage record holds both the used count and the
//   finalized requestId set. One write atomically records both
//   consumption and idempotency — no crash window between two
//   separate keys that could double-consume or under-consume.
//
//   Record shape:
//     { used: 0..3, finalizedRequestIds: string[], updatedAt: ISO }
//
//   finalizedRequestIds is bounded to the last 50 entries.
//
// EFFECTIVE FREE REMAINING:
//   effectiveRemaining = min(accountRemaining, installRemaining)
//   Pro bypasses this guard entirely.
//
// CENTRAL ENFORCEMENT:
//   checkInstallExpandedIngredientEligibility() is called by the
//   central gate (blendNutritionGate.authorizeAndProcessBatch)
//   BEFORE reserve/analyze. If the install guard is exhausted,
//   the analysis is blocked locally — no server call, no
//   expensive nutrition work.
//
//   If authoritative account allowance cannot be determined, the
//   gate fails closed (blocks) rather than assuming 3/3.
//
// SELF-HEAL:
//   When an authoritative Free account reports used >= 1 and the
//   install guard has no record (or lower used), self-heal
//   conservatively:
//     installUsed = max(existingInstallUsed, authoritativeFreeUsed)
//
//   A fresh account (used=0) must NEVER decrease the install-used
//   count.
//
// PRE-LOGOUT SELF-HEAL:
//   Before discarding the current Free identity, fetch the
//   authoritative account allowance and self-heal the install
//   state. This protects old-build users who already used
//   analyses but haven't visited a UI surface that performed the
//   new self-heal. Network failure does not prevent logout.
//
// SUCCESSFUL CONSUMPTION ONLY:
//   The install used count is incremented only after a successful
//   finalization. Failed analyses, canceled requests, released
//   reservations, and duplicate finalizations do NOT consume.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'
import { FREE_ADVANCED_BLEND_ALLOWANCE } from './blendAllowanceService'

// ── Storage key ───────────────────────────────────────────────

export const INSTALL_EXPANDED_INGREDIENT_KEY = '@juicing_install_expanded_ingredient_v1'
// Legacy key from the previous two-key design — cleaned up on read.
const LEGACY_FINALIZED_KEY = '@juicing_install_expanded_ingredient_finalized_v1'

const MAX_FINALIZED_IDS = 50

// ── Atomic record type ────────────────────────────────────────

interface InstallExpandedIngredientRecord {
  used: number
  finalizedRequestIds: string[]
  updatedAt: string
}

// ── Read / Write (single atomic record) ───────────────────────

async function readRecord(): Promise<InstallExpandedIngredientRecord> {
  try {
    const raw = await AsyncStorage.getItem(INSTALL_EXPANDED_INGREDIENT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<InstallExpandedIngredientRecord>
      const used = typeof parsed.used === 'number' ? Math.max(0, Math.min(parsed.used, FREE_ADVANCED_BLEND_ALLOWANCE)) : 0
      const finalizedRequestIds = Array.isArray(parsed.finalizedRequestIds)
        ? parsed.finalizedRequestIds.filter((id): id is string => typeof id === 'string')
        : []
      return { used, finalizedRequestIds, updatedAt: parsed.updatedAt ?? '' }
    }
    // Migrate from legacy two-key design if the old finalized key exists
    const legacyRaw = await AsyncStorage.getItem(LEGACY_FINALIZED_KEY)
    if (legacyRaw) {
      try {
        const legacyIds = JSON.parse(legacyRaw) as string[]
        if (Array.isArray(legacyIds)) {
          // The old used count was in a separate key — but we may not
          // have it. Default to 0 and let self-heal correct it.
          const record: InstallExpandedIngredientRecord = {
            used: 0,
            finalizedRequestIds: legacyIds.filter((id): id is string => typeof id === 'string'),
            updatedAt: new Date().toISOString(),
          }
          await AsyncStorage.setItem(INSTALL_EXPANDED_INGREDIENT_KEY, JSON.stringify(record))
          await AsyncStorage.removeItem(LEGACY_FINALIZED_KEY)
          return record
        }
      } catch {
        // Ignore malformed legacy data
      }
    }
  } catch {
    // Fall through to empty record
  }
  return { used: 0, finalizedRequestIds: [], updatedAt: '' }
}

async function writeRecord(record: InstallExpandedIngredientRecord): Promise<void> {
  // Clamp used and bound finalizedRequestIds in one atomic write
  const clamped: InstallExpandedIngredientRecord = {
    used: Math.max(0, Math.min(record.used, FREE_ADVANCED_BLEND_ALLOWANCE)),
    finalizedRequestIds: record.finalizedRequestIds.slice(-MAX_FINALIZED_IDS),
    updatedAt: new Date().toISOString(),
  }
  await AsyncStorage.setItem(INSTALL_EXPANDED_INGREDIENT_KEY, JSON.stringify(clamped))
}

// ── Public API ────────────────────────────────────────────────

// Get the current install-level used count (0–3).
export async function getInstallExpandedIngredientUsed(): Promise<number> {
  const record = await readRecord()
  return record.used
}

// Get the install-level remaining count (3 - used, clamped to 0).
export async function getInstallExpandedIngredientRemaining(): Promise<number> {
  const used = await getInstallExpandedIngredientUsed()
  return Math.max(0, FREE_ADVANCED_BLEND_ALLOWANCE - used)
}

// Compose the effective remaining for Free users.
// Returns min(account remaining, install remaining).
// For Pro, returns null (unlimited — caller should bypass).
// If accountRemaining is null (unknown), returns null (fail-closed).
export async function composeEffectiveExpandedIngredientRemaining(
  accountRemaining: number | null,
  isPro: boolean,
): Promise<number | null> {
  if (isPro) return null
  if (accountRemaining === null) return null
  const installRemaining = await getInstallExpandedIngredientRemaining()
  return Math.min(accountRemaining, installRemaining)
}

// Self-heal the install used count from an authoritative Free
// account snapshot. This is conservative — it only INCREASES the
// install used count, never decreases it.
//
// installUsed = max(existingInstallUsed, authoritativeFreeUsed)
//
// Returns true if the install state was updated.
export async function selfHealInstallExpandedIngredient(
  authoritativeUsed: number,
  isPro: boolean,
): Promise<boolean> {
  // Pro usage must NOT consume the Free lifetime pool.
  if (isPro) return false
  // Negative or NaN used is malformed — ignore.
  if (typeof authoritativeUsed !== 'number' || authoritativeUsed < 0) return false
  const existing = await readRecord()
  const newUsed = Math.max(existing.used, Math.min(authoritativeUsed, FREE_ADVANCED_BLEND_ALLOWANCE))
  if (newUsed > existing.used) {
    await writeRecord({ ...existing, used: newUsed })
    return true
  }
  return false
}

// CENTRAL ENFORCEMENT: Check whether a Free user is eligible to
// start a new Expanded Ingredient Analysis. This is called by the
// central gate (blendNutritionGate) BEFORE reserve/analyze.
//
// Returns { allowed: true } if the analysis may proceed.
// Returns { allowed: false, code: string } if blocked.
//
// Pro users always pass (unlimited).
// Unknown account allowance → fail-closed (blocked).
// Install exhausted → blocked.
export async function checkInstallExpandedIngredientEligibility(
  accountRemaining: number | null,
  isPro: boolean,
): Promise<{ allowed: boolean; code: string; effectiveRemaining: number | null }> {
  if (isPro) return { allowed: true, code: 'pro_unlimited', effectiveRemaining: null }
  if (accountRemaining === null) {
    return { allowed: false, code: 'allowance_unknown', effectiveRemaining: null }
  }
  const installRemaining = await getInstallExpandedIngredientRemaining()
  const effectiveRemaining = Math.min(accountRemaining, installRemaining)
  if (effectiveRemaining <= 0) {
    return { allowed: false, code: 'install_exhausted', effectiveRemaining: 0 }
  }
  return { allowed: true, code: 'ok', effectiveRemaining }
}

// Mark a successful Expanded Ingredient Analysis as consumed.
// This is idempotent — the same requestId cannot increment the
// install count twice. Both the used count and the finalized
// requestId are written in a SINGLE AsyncStorage.setItem call,
// making the operation atomic with respect to crashes.
//
// Pro users: this function is a no-op (Pro usage does NOT consume
// the Free lifetime pool).
//
// Returns true if the install count was incremented.
export async function markInstallExpandedIngredientConsumed(
  requestId: string,
  isPro: boolean,
): Promise<boolean> {
  // Pro usage must NOT consume the Free lifetime pool.
  if (isPro) return false
  if (!requestId) return false
  // Read the current record (used + finalizedRequestIds in one read)
  const record = await readRecord()
  // Check idempotency — has this requestId already been finalized?
  if (record.finalizedRequestIds.includes(requestId)) return false
  // Check exhaustion
  if (record.used >= FREE_ADVANCED_BLEND_ALLOWANCE) return false
  // Atomically write both the incremented used count AND the
  // finalized requestId in a single setItem call.
  const newRecord: InstallExpandedIngredientRecord = {
    used: record.used + 1,
    finalizedRequestIds: [...record.finalizedRequestIds, requestId],
    updatedAt: new Date().toISOString(),
  }
  await writeRecord(newRecord)
  return true
}

// PRE-LOGOUT SELF-HEAL: Fetch the authoritative account allowance
// for the departing Free identity and self-heal the install state
// before the identity is discarded.
//
// This is best-effort — a network failure does NOT prevent logout.
// The caller should call this before clearing the session, but
// should proceed with logout regardless of the result.
//
// Parameters:
//   fetchAllowance: async function returning { used: number, plan: string } | null
//   isPro: boolean — if Pro, this is a no-op
//
// Returns true if the install state was updated.
export async function preLogoutSelfHealExpandedIngredient(
  fetchAllowance: () => Promise<{ used: number; plan: string } | null>,
  isPro: boolean,
): Promise<boolean> {
  if (isPro) return false
  try {
    const snapshot = await fetchAllowance()
    if (!snapshot) return false
    const departingIsPro = snapshot.plan === 'pro'
    if (departingIsPro) return false
    return await selfHealInstallExpandedIngredient(snapshot.used, false)
  } catch {
    // Network failure — do not prevent logout
    return false
  }
}

// Clear all install Expanded Ingredient state (for nuclear reset).
export async function clearInstallExpandedIngredientState(): Promise<void> {
  await AsyncStorage.removeItem(INSTALL_EXPANDED_INGREDIENT_KEY)
  await AsyncStorage.removeItem(LEGACY_FINALIZED_KEY)
}
