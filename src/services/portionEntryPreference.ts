// ─────────────────────────────────────────────────────────────
// portionEntryPreference.ts
//
// Preference persistence for the Preferred Portion Entry setting.
// Uses the existing storage.ts module — no second storage framework.
//
// Default: 'weight'
// Invalid/corrupted values safely fall back to 'weight'.
//
// The preference determines only the initial mode for newly created
// ingredient rows. It must not alter existing rows, recipes, or
// JuiceEngine calculations.
// ─────────────────────────────────────────────────────────────

import { loadState, saveStateImmediate, ALL_STORAGE_KEYS } from './storage'
import type { PortionEntryMode } from './producePortionConversion'

// ── Constants ────────────────────────────────────────────────

export const PORTION_ENTRY_PREF_KEY = '@juicing_portion_entry_mode_v1'
const PREF_SCHEMA_VERSION = 2
const DEFAULT_MODE: PortionEntryMode = 'weight'

// Verify key is registered for nuclear reset
if (!ALL_STORAGE_KEYS.includes(PORTION_ENTRY_PREF_KEY as any)) {
  console.warn(`[portionEntryPreference] Key ${PORTION_ENTRY_PREF_KEY} not in ALL_STORAGE_KEYS — nuclear reset will not clear it.`)
}

// ── Sanitize ─────────────────────────────────────────────────

function sanitizePortionMode(raw: unknown): PortionEntryMode {
  if (raw === 'weight' || raw === 'quantity') return raw
  return DEFAULT_MODE
}

// ── Public API ───────────────────────────────────────────────

export function normalizePreferredPortionEntryMode(value: unknown): PortionEntryMode {
  if (value === 'weight' || value === 'quantity') return value
  return DEFAULT_MODE
}

export async function getPreferredPortionEntryMode(): Promise<PortionEntryMode> {
  try {
    const result = await loadState<PortionEntryMode>({
      key: PORTION_ENTRY_PREF_KEY,
      version: PREF_SCHEMA_VERSION,
      sanitize: sanitizePortionMode,
    })
    if (result === 'weight' || result === 'quantity') return result
    return DEFAULT_MODE
  } catch {
    return DEFAULT_MODE
  }
}

export async function setPreferredPortionEntryMode(mode: PortionEntryMode): Promise<void> {
  const normalized = normalizePreferredPortionEntryMode(mode)
  await saveStateImmediate(PORTION_ENTRY_PREF_KEY, PREF_SCHEMA_VERSION, normalized)
}
