// ─────────────────────────────────────────────────────────────
// storage.ts — Dedicated persistence module for production tracking.
//
// Responsibilities:
//   - Schema-versioned AsyncStorage wrapper
//   - Debounced writes (300ms) to avoid performance issues
//   - Safe hydration with validation + migration
//   - Type-safe PersistedState envelope
//   - resetAllStorageKeys() for nuclear dev reset
//
// All stores delegate persistence through this module.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'

// ── Schema Version ───────────────────────────────────────────

/**
 * Bump this when the persisted shape changes.
 * Add a migration function in MIGRATIONS for each version bump.
 */
export const CURRENT_SCHEMA_VERSION = 2

// ── Types ────────────────────────────────────────────────────

/** Envelope wrapping any persisted payload with version metadata */
export interface PersistedEnvelope<T> {
  schemaVersion: number
  persistedAt: string   // local-time ISO string
  payload: T
}

/** Options for creating a storage adapter */
export interface StorageAdapterOptions<T> {
  /** AsyncStorage key */
  key: string
  /** Current schema version for this store */
  version: number
  /** Validate and sanitize raw payload from storage */
  sanitize: (raw: unknown) => T
  /** Optional migration from older schema versions */
  migrate?: (raw: unknown, fromVersion: number) => unknown
}

// ── Local-Time ISO Helper ────────────────────────────────────

function localISOString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}:${s}`
}

// ── Migration Registry ───────────────────────────────────────

/**
 * Migration functions keyed by target version.
 * Each function receives the raw payload from the previous version
 * and returns the migrated payload for the target version.
 *
 * Example: MIGRATIONS[2] migrates from v1 → v2.
 */
type MigrationFn = (raw: unknown) => unknown

const MIGRATIONS: Record<number, MigrationFn> = {
  // v1 → v2: Add schemaVersion envelope to bare payloads.
  // v1 data was stored without an envelope, so we wrap it.
  2: (raw: unknown) => raw, // payload shape unchanged, just envelope added
}

/**
 * Run sequential migrations from `fromVersion` to `toVersion`.
 * Each step applies the migration for that target version.
 */
function runMigrations(
  raw: unknown,
  fromVersion: number,
  toVersion: number,
  customMigrate?: (raw: unknown, fromVersion: number) => unknown,
): unknown {
  let current = raw
  for (let v = fromVersion + 1; v <= toVersion; v++) {
    if (customMigrate) {
      current = customMigrate(current, v - 1)
    } else if (MIGRATIONS[v]) {
      current = MIGRATIONS[v](current)
    }
  }
  return current
}

// ── Debounce Timer Map ───────────────────────────────────────

const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {}
const DEBOUNCE_MS = 300

// ── Core Functions ───────────────────────────────────────────

/**
 * Load state from AsyncStorage with schema validation and migration.
 *
 * Returns `null` if no data exists or data is unrecoverable.
 * Never throws — all errors are caught and logged.
 */
export async function loadState<T>(
  options: StorageAdapterOptions<T>,
): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(options.key)
    if (!raw) return null

    const parsed = JSON.parse(raw)

    // Detect envelope vs bare payload (v1 had no envelope)
    let payload: unknown
    let fromVersion: number

    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.schemaVersion === 'number' &&
      'payload' in parsed
    ) {
      // Enveloped data (v2+)
      fromVersion = parsed.schemaVersion
      payload = parsed.payload
    } else {
      // Bare payload (v1 — no envelope)
      fromVersion = 1
      payload = parsed
    }

    // Run migrations if needed
    if (fromVersion < options.version) {
      payload = runMigrations(payload, fromVersion, options.version, options.migrate)
      // Re-persist migrated data immediately
      await saveStateImmediate(options.key, options.version, payload)
    }

    // Sanitize and return
    return options.sanitize(payload)
  } catch (e) {
    console.warn(`[storage] loadState(${options.key}) failed:`, (e as Error)?.message)
    return null
  }
}

/**
 * Save state to AsyncStorage with debouncing (300ms).
 * Multiple rapid calls within the debounce window are coalesced.
 *
 * Never throws — all errors are caught and logged.
 */
export function saveState<T>(
  key: string,
  version: number,
  payload: T,
): void {
  // Cancel any pending write for this key
  if (debounceTimers[key]) {
    clearTimeout(debounceTimers[key])
  }

  debounceTimers[key] = setTimeout(() => {
    delete debounceTimers[key]
    saveStateImmediate(key, version, payload).catch((e) => {
      console.warn(`[storage] saveState(${key}) failed:`, (e as Error)?.message)
    })
  }, DEBOUNCE_MS)
}

/**
 * Save state immediately (no debounce). Used for migrations
 * and explicit flush scenarios.
 */
export async function saveStateImmediate<T>(
  key: string,
  version: number,
  payload: T,
): Promise<void> {
  try {
    const envelope: PersistedEnvelope<T> = {
      schemaVersion: version,
      persistedAt: localISOString(),
      payload,
    }
    await AsyncStorage.setItem(key, JSON.stringify(envelope))
  } catch (e) {
    console.warn(`[storage] saveStateImmediate(${key}) failed:`, (e as Error)?.message)
  }
}

/**
 * Flush any pending debounced write for a specific key.
 * Useful before app backgrounding or nuclear reset.
 */
export function flushPendingWrite(key: string): void {
  if (debounceTimers[key]) {
    clearTimeout(debounceTimers[key])
    delete debounceTimers[key]
  }
}

/**
 * Remove a single key from AsyncStorage.
 */
export async function clearState(key: string): Promise<void> {
  flushPendingWrite(key)
  try {
    await AsyncStorage.removeItem(key)
  } catch (e) {
    console.warn(`[storage] clearState(${key}) failed:`, (e as Error)?.message)
  }
}

// ── Storage Keys Registry ────────────────────────────────────

/** All AsyncStorage keys used by the app — for nuclear reset */
export const ALL_STORAGE_KEYS = [
  '@juicing_user_profile_v1',
  '@juicing_feature_flags_v2',
  '@juicing_challenge_v1',
  '@juicing_streak_v1',
  '@juicing_templates_v1',
  '@juicing_social_challenges_v1',
  '@juicing_photo_drafts_v1',
  '@juicing_pantry_v1',
  '@juicing_education_v1',
  '@juicing_weight_unit_v1',
  '@juicing_organic_pref_v1',
  '@juicing_pending_quick_logs',
  '@juicing_first_log_done',
  '@juicing_first_launch_orchestrator_done',
  '@juicing_install_id',
  '@juicing_feature_flags_v1',
  '@settings_visited',
  '@juicing_calculator_cache_v1',
  '@juicing_activation_v1',
  '@juicing_nutrition_score_v1',
  '@juicing_performance_onboarding_done',
  '@juicing_log_entries_v1',
] as const

/**
 * Nuclear reset — clears ALL app data from AsyncStorage.
 * Flushes any pending debounced writes first.
 */
export async function resetAllStorageKeys(): Promise<void> {
  // Flush all pending writes
  for (const key of Object.keys(debounceTimers)) {
    flushPendingWrite(key)
  }
  try {
    await AsyncStorage.multiRemove([...ALL_STORAGE_KEYS])
  } catch (e) {
    // Best-effort — some keys may not exist
    console.warn('[storage] resetAllStorageKeys failed:', (e as Error)?.message)
  }
}
