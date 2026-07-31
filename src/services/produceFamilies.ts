// src/services/produceFamilies.ts
// Centralized, explicit produce-family/alias mapping.
// Maps genuine produce variants (e.g. apple colors, bell-pepper colors, cabbage colors)
// to a shared family key so that Produce-First recipe matching can treat them as
// equivalent without unrestricted substring matching.

// ── Family groups ─────────────────────────────────────────────
// Each group lists produce IDs that are genuine variants of the same produce.
// Only add a group when the existing data clearly demonstrates variant relationship.

export const PRODUCE_FAMILIES: Record<string, string[]> = {
  apple: ['apple', 'apple_green', 'apple_red'],
  bell_pepper: ['bell_pepper_red', 'bell_pepper_yellow', 'bell_pepper_green'],
  cabbage: ['cabbage_green', 'cabbage_red'],
}

// ── Reverse lookup: produceId -> familyKey ───────────────────
const PRODUCE_TO_FAMILY: Record<string, string> = {}
for (const [familyKey, members] of Object.entries(PRODUCE_FAMILIES)) {
  for (const pid of members) {
    PRODUCE_TO_FAMILY[pid.toLowerCase()] = familyKey
  }
}

// ── API ──────────────────────────────────────────────────────

export function getProduceFamilyKey(produceId: string): string | null {
  return PRODUCE_TO_FAMILY[produceId.toLowerCase()] ?? null
}

export function getProduceFamilyMembers(produceId: string): string[] {
  const familyKey = getProduceFamilyKey(produceId)
  if (!familyKey) return []
  return PRODUCE_FAMILIES[familyKey].map((id) => id.toLowerCase())
}

export function areProduceFamilyEquivalent(
  leftProduceId: string,
  rightProduceId: string
): boolean {
  const leftLower = leftProduceId.toLowerCase()
  const rightLower = rightProduceId.toLowerCase()
  if (leftLower === rightLower) return true
  const leftFamily = PRODUCE_TO_FAMILY[leftLower]
  const rightFamily = PRODUCE_TO_FAMILY[rightLower]
  if (!leftFamily || !rightFamily) return false
  return leftFamily === rightFamily
}

// ── Search aliases for variant produce ────────────────────────
// Allows searching for variants using both common word orders.
// e.g. "red apple" and "apple red" both find apple_red.
// Also includes the generic family name so variants are discoverable
// by the generic term (e.g. "apple" finds apple_red).

export const PRODUCE_SEARCH_ALIASES: Record<string, string[]> = {
  apple_red: ['red apple', 'apple red', 'apple'],
  apple_green: ['green apple', 'apple green', 'apple'],
  apple: ['apple', 'apples'],
  bell_pepper_red: ['red bell pepper', 'bell pepper red', 'bell pepper'],
  bell_pepper_yellow: ['yellow bell pepper', 'bell pepper yellow', 'bell pepper'],
  bell_pepper_green: ['green bell pepper', 'bell pepper green', 'bell pepper'],
  cabbage_red: ['red cabbage', 'cabbage red', 'cabbage'],
  cabbage_green: ['green cabbage', 'cabbage green', 'cabbage'],
}

// ── Variant display labels ───────────────────────────────────
// Family-first display for known variants where natural.
// e.g. "Apple, Red" instead of "Red Apple".
// Generic family labels remain unchanged (e.g. "Apple").

export const PRODUCE_VARIANT_DISPLAY_NAMES: Record<string, string> = {
  apple_red: 'Apple, Red',
  apple_green: 'Apple, Green',
  bell_pepper_red: 'Bell Pepper, Red',
  bell_pepper_yellow: 'Bell Pepper, Yellow',
  bell_pepper_green: 'Bell Pepper, Green',
  cabbage_red: 'Cabbage, Red',
  cabbage_green: 'Cabbage, Green',
}

export function getProduceVariantDisplayName(produceId: string): string | null {
  return PRODUCE_VARIANT_DISPLAY_NAMES[produceId.toLowerCase()] ?? null
}
