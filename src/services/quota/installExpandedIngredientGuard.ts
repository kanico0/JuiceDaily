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
// Effective Free remaining = min(account remaining, install remaining)
// Pro bypasses this guard entirely.
//
// SELF-HEAL:
//   When an authoritative Free account reports used >= 1 and the
//   install guard has no record, self-heal conservatively:
//     installUsed = max(existingInstallUsed, authoritativeFreeUsed)
//   This ensures an existing installation that already used
//   analyses before this guard existed is correctly tracked.
//
//   A fresh account (used=0) must NEVER decrease an existing
//   install-used count.
//
// SUCCESSFUL CONSUMPTION ONLY:
//   The install used count is incremented only after a successful
//   finalization. Failed analyses, canceled requests, released
//   reservations, and duplicate finalizations do NOT consume.
//
// IDEMPOTENCY:
//   A set of finalized request IDs is tracked to prevent the same
//   successful request from incrementing the install count twice.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'
import { FREE_ADVANCED_BLEND_ALLOWANCE } from './blendAllowanceService'

// ── Storage keys ──────────────────────────────────────────────

export const INSTALL_EXPANDED_INGREDIENT_KEY = '@juicing_install_expanded_ingredient_v1'
export const INSTALL_EXPANDED_INGREDIENT_FINALIZED_KEY = '@juicing_install_expanded_ingredient_finalized_v1'

interface InstallExpandedIngredientRecord {
  used: number
  updatedAt: string
}

// ── Read / Write ──────────────────────────────────────────────

async function readRecord(): Promise<InstallExpandedIngredientRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(INSTALL_EXPANDED_INGREDIENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as InstallExpandedIngredientRecord
    if (typeof parsed.used !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

async function writeRecord(used: number): Promise<void> {
  const record: InstallExpandedIngredientRecord = {
    used: Math.max(0, Math.min(used, FREE_ADVANCED_BLEND_ALLOWANCE)),
    updatedAt: new Date().toISOString(),
  }
  await AsyncStorage.setItem(INSTALL_EXPANDED_INGREDIENT_KEY, JSON.stringify(record))
}

// ── Finalized request ID set (idempotency) ────────────────────

async function readFinalizedIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(INSTALL_EXPANDED_INGREDIENT_FINALIZED_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr)
  } catch {
    return new Set()
  }
}

async function addFinalizedId(requestId: string): Promise<void> {
  const ids = await readFinalizedIds()
  ids.add(requestId)
  // Keep only the last 100 to avoid unbounded growth
  const arr = [...ids].slice(-100)
  await AsyncStorage.setItem(INSTALL_EXPANDED_INGREDIENT_FINALIZED_KEY, JSON.stringify(arr))
}

// ── Public API ────────────────────────────────────────────────

// Get the current install-level used count (0–3).
export async function getInstallExpandedIngredientUsed(): Promise<number> {
  const record = await readRecord()
  return record ? record.used : 0
}

// Get the install-level remaining count (3 - used, clamped to 0).
export async function getInstallExpandedIngredientRemaining(): Promise<number> {
  const used = await getInstallExpandedIngredientUsed()
  return Math.max(0, FREE_ADVANCED_BLEND_ALLOWANCE - used)
}

// Compose the effective remaining for Free users.
// Returns min(account remaining, install remaining).
// For Pro, returns null (unlimited — caller should bypass).
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
// This ensures:
//   - An existing installation that used analyses before this guard
//     existed is correctly tracked.
//   - A fresh account (used=0) does NOT reset the install state.
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
  const existingUsed = existing ? existing.used : 0
  const newUsed = Math.max(existingUsed, Math.min(authoritativeUsed, FREE_ADVANCED_BLEND_ALLOWANCE))
  if (newUsed > existingUsed) {
    await writeRecord(newUsed)
    return true
  }
  return false
}

// Mark a successful Expanded Ingredient Analysis as consumed.
// This is idempotent — the same requestId cannot increment the
// install count twice.
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
  // Check idempotency — has this requestId already been finalized?
  const finalizedIds = await readFinalizedIds()
  if (finalizedIds.has(requestId)) return false
  // Increment the install used count
  const currentUsed = await getInstallExpandedIngredientUsed()
  if (currentUsed >= FREE_ADVANCED_BLEND_ALLOWANCE) return false
  await writeRecord(currentUsed + 1)
  await addFinalizedId(requestId)
  return true
}

// Clear all install Expanded Ingredient state (for nuclear reset).
export async function clearInstallExpandedIngredientState(): Promise<void> {
  await AsyncStorage.removeItem(INSTALL_EXPANDED_INGREDIENT_KEY)
  await AsyncStorage.removeItem(INSTALL_EXPANDED_INGREDIENT_FINALIZED_KEY)
}
