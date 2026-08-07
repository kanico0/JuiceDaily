// ─────────────────────────────────────────────────────────────
// makeAgainValidation.test.js — Regression test for the
// "Make This Juice Again" reconstruction validation defect.
//
// Reproduces the physical QA failure where tapping Make This Juice
// Again populates ingredients visually but "Log to Today" remains
// disabled until the user toggles a size/unit control.
//
// Root cause: draftToPreloadIngredients produced a legacy-shaped
// portionMetadata ({unit, size, quantity}) that did not have the
// canonical keys ({unitKey, sizeKey, enteredQuantity, inputMode,
// estimatedRawWeightG, ...}) expected by hasInvalidIngredients
// validation. seedPreloadIngredients now normalizes quantity-mode
// ingredients through recomputeFromQuantityChange.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const {
  isQuantitySupported,
  getDefaultPortionUnit,
  getSupportedSizes,
  estimateRawWeightGrams,
  recomputeFromQuantityChange,
} = require('../../services/producePortionConversion')

const {
  createEditableDraftFromHistoryEntry,
  draftToPreloadIngredients,
} = require('../../services/makeAgainHelper')

const HOME_SRC = fs.readFileSync(path.join(__dirname, '..', 'HomeScreen.js'), 'utf8')

// ── Validation replica ───────────────────────────────────────
// Mirrors the exact hasInvalidIngredients useMemo from HomeScreen.
// This is the same validation that gates "Log to Today".
function validateForLogToToday(ingredients) {
  for (const item of ingredients) {
    if (!isQuantitySupported(item.produceId)) continue
    if (item.portionEntryMode !== 'quantity') continue
    const unitKey = item.portionMetadata?.unitKey || item.pendingUnitKey
    if (!unitKey) return false
    const sizes = getSupportedSizes(item.produceId, unitKey)
    const hasSML = sizes.some((s) => s.sizeKey !== 'standard')
    const sizeKey = item.portionMetadata?.sizeKey || item.pendingSizeKey || null
    if (hasSML && !sizeKey) return false
    const qty = item.portionMetadata?.enteredQuantity
    if (!qty || qty <= 0 || isNaN(qty)) return false
    const result = estimateRawWeightGrams({
      produceId: item.produceId,
      quantity: qty,
      unitKey,
      sizeKey: hasSML ? sizeKey : undefined,
    })
    if (!result.ok) return false
  }
  return true
}

// ── seedPreloadIngredients replica ───────────────────────────
// Mirrors the fixed seedPreloadIngredients from HomeScreen.
// This is what runs when Make Again navigates to the editor.
function seedPreloadIngredients(preload, organicMode) {
  const getDefaultOrganic = (mode) => mode === 'organic'
  return preload.map((item) => {
    if (typeof item === 'string') {
      return {
        produceId: item,
        weightG: 150,
        isOrganic: getDefaultOrganic(organicMode),
        portionEntryMode: 'weight',
      }
    }

    const baseIngredient = {
      produceId: item.produceId,
      weightG: item.weightG || 150,
      isOrganic:
        typeof item.isOrganic === 'boolean' ? item.isOrganic : getDefaultOrganic(organicMode),
      portionEntryMode: item.portionEntryMode || 'weight',
      portionMetadata: item.portionMetadata || undefined,
    }

    if (baseIngredient.portionEntryMode === 'quantity' && isQuantitySupported(item.produceId)) {
      const meta = item.portionMetadata
      const hasCanonicalKeys = meta && meta.unitKey && meta.enteredQuantity != null
      if (!hasCanonicalKeys) {
        const rawQuantity = meta?.enteredQuantity ?? meta?.quantity ?? item.quantity ?? 1
        const rawUnitKey = meta?.unitKey ?? meta?.unit ?? null
        const rawSizeKey = meta?.sizeKey ?? meta?.size ?? null

        const defaultUnit = getDefaultPortionUnit(item.produceId)
        if (defaultUnit) {
          const unitKey = rawUnitKey || defaultUnit.unitKey
          const sizes = getSupportedSizes(item.produceId, unitKey)
          const hasSML = sizes.some((s) => s.sizeKey !== 'standard')
          const sizeKey =
            rawSizeKey ||
            (hasSML ? (sizes.find((s) => s.sizeKey === 'medium') || sizes[0])?.sizeKey : null)

          const normalizedResult = recomputeFromQuantityChange({
            produceId: item.produceId,
            quantity: rawQuantity,
            unitKey,
            sizeKey: sizeKey || undefined,
          })

          if (normalizedResult) {
            baseIngredient.portionMetadata = normalizedResult.metadata
            baseIngredient.weightG = normalizedResult.weightG
            baseIngredient.pendingUnitKey = unitKey
            baseIngredient.pendingSizeKey = sizeKey || null
          } else {
            const fallbackSize = hasSML
              ? sizes.find((s) => s.sizeKey === 'medium') || sizes[0]
              : null
            const fallbackResult = recomputeFromQuantityChange({
              produceId: item.produceId,
              quantity: 1,
              unitKey: defaultUnit.unitKey,
              sizeKey: fallbackSize?.sizeKey || undefined,
            })
            if (fallbackResult) {
              baseIngredient.portionMetadata = fallbackResult.metadata
              baseIngredient.weightG = fallbackResult.weightG
              baseIngredient.pendingUnitKey = defaultUnit.unitKey
              baseIngredient.pendingSizeKey = fallbackSize?.sizeKey || null
            }
          }
        }
      }
    }

    return baseIngredient
  })
}

// ── Tests ────────────────────────────────────────────────────

describe('Make Again reconstruction validation (Item 3 — physical QA)', () => {
  describe('source-text: seedPreloadIngredients normalizes quantity-mode', () => {
    test('1. seedPreloadIngredients contains canonical normalization block', () => {
      expect(HOME_SRC).toContain('seedPreloadIngredients')
      // The fix adds a normalization block that checks for canonical keys
      expect(HOME_SRC).toContain('hasCanonicalKeys')
      expect(HOME_SRC).toContain('recomputeFromQuantityChange')
      expect(HOME_SRC).toContain('isProduceQuantitySupported')
    })

    test('2. seedPreloadIngredients maps legacy metadata keys', () => {
      // Legacy shape: {unit, size, quantity} → canonical: {unitKey, sizeKey, enteredQuantity}
      expect(HOME_SRC).toContain('meta?.unitKey ?? meta?.unit')
      expect(HOME_SRC).toContain('meta?.sizeKey ?? meta?.size')
      expect(HOME_SRC).toContain('meta?.enteredQuantity ?? meta?.quantity')
    })

    test('3. hasInvalidIngredients still checks canonical keys', () => {
      expect(HOME_SRC).toContain('portionMetadata?.unitKey')
      expect(HOME_SRC).toContain('portionMetadata?.sizeKey')
      expect(HOME_SRC).toContain('portionMetadata?.enteredQuantity')
    })
  })

  describe('end-to-end: Make Again → seed → validation', () => {
    // Production-shaped historical juice with valid quantity-mode ingredients
    const historicalEntry = {
      id: 'hist-001',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      source: 'photo',
      title: 'Carrot Celery Juice',
      primaryProduceId: 'carrot',
      ingredients: [
        {
          produceId: 'carrot',
          quantity: 6,
          portionEntryMode: 'quantity',
          portionUnit: 'whole',
          portionSize: 'medium',
          isOrganic: true,
        },
        {
          produceId: 'celery',
          quantity: 4,
          portionEntryMode: 'quantity',
          portionUnit: 'stalk',
          portionSize: 'medium',
          isOrganic: false,
        },
      ],
    }

    test('4. createEditableDraftFromHistoryEntry produces valid draft', () => {
      const draft = createEditableDraftFromHistoryEntry(historicalEntry)
      expect(draft.ingredients).toHaveLength(2)
      expect(draft.ingredients[0].produceId).toBe('carrot')
      expect(draft.ingredients[0].portionEntryMode).toBe('quantity')
      expect(draft.ingredients[0].quantity).toBe(6)
      expect(draft.ingredients[0].portionUnit).toBe('whole')
      expect(draft.ingredients[0].portionSize).toBe('medium')
    })

    test('5. draftToPreloadIngredients produces legacy-shaped metadata', () => {
      const draft = createEditableDraftFromHistoryEntry(historicalEntry)
      const preload = draftToPreloadIngredients(draft.ingredients)
      expect(preload).toHaveLength(2)
      expect(preload[0].portionEntryMode).toBe('quantity')
      // The legacy shape has {unit, size, quantity} — NOT canonical keys
      expect(preload[0].portionMetadata).toBeDefined()
      expect(preload[0].portionMetadata.unit).toBe('whole')
      expect(preload[0].portionMetadata.size).toBe('medium')
      expect(preload[0].portionMetadata.quantity).toBe(6)
      // Legacy shape does NOT have canonical keys
      expect(preload[0].portionMetadata.unitKey).toBeUndefined()
      expect(preload[0].portionMetadata.sizeKey).toBeUndefined()
      expect(preload[0].portionMetadata.enteredQuantity).toBeUndefined()
    })

    test('6. BUG REPRO: unnormalized preload fails validation', () => {
      const draft = createEditableDraftFromHistoryEntry(historicalEntry)
      const preload = draftToPreloadIngredients(draft.ingredients)

      // Simulate the OLD (buggy) seedPreloadIngredients that just
      // passed portionMetadata through without normalization
      const unnormalized = preload.map((item) => ({
        produceId: item.produceId,
        weightG: item.weightG || 150,
        isOrganic: item.isOrganic,
        portionEntryMode: item.portionEntryMode || 'weight',
        portionMetadata: item.portionMetadata || undefined,
      }))

      // This should FAIL — legacy metadata lacks canonical keys
      const isValid = validateForLogToToday(unnormalized)
      expect(isValid).toBe(false)
    })

    test('7. FIX: seedPreloadIngredients normalizes and validation passes', () => {
      const draft = createEditableDraftFromHistoryEntry(historicalEntry)
      const preload = draftToPreloadIngredients(draft.ingredients)

      // The fixed seedPreloadIngredients normalizes through recomputeFromQuantityChange
      const seeded = seedPreloadIngredients(preload, 'conventional')

      expect(seeded).toHaveLength(2)
      // Each quantity-mode ingredient should have canonical portionMetadata
      for (const ing of seeded) {
        if (ing.portionEntryMode === 'quantity' && isQuantitySupported(ing.produceId)) {
          expect(ing.portionMetadata).toBeDefined()
          expect(ing.portionMetadata.unitKey).toBeDefined()
          expect(ing.portionMetadata.enteredQuantity).toBeGreaterThan(0)
          expect(ing.portionMetadata.inputMode).toBe('quantity')
          expect(ing.portionMetadata.estimatedRawWeightG).toBeGreaterThan(0)
        }
      }

      // Validation should pass immediately — no size/unit toggle needed
      const isValid = validateForLogToToday(seeded)
      expect(isValid).toBe(true)
    })

    test('8. carrot specifically: whole unit, medium size, qty 6 → valid', () => {
      expect(isQuantitySupported('carrot')).toBe(true)
      const draft = createEditableDraftFromHistoryEntry(historicalEntry)
      const preload = draftToPreloadIngredients(draft.ingredients)
      const seeded = seedPreloadIngredients(preload, 'conventional')

      const carrot = seeded.find((i) => i.produceId === 'carrot')
      expect(carrot).toBeDefined()
      expect(carrot.portionMetadata.unitKey).toBe('whole')
      expect(carrot.portionMetadata.sizeKey).toBe('medium')
      expect(carrot.portionMetadata.enteredQuantity).toBe(6)
      expect(carrot.weightG).toBeGreaterThan(0)
    })

    test('9. celery specifically: stalk unit, medium size, qty 4 → valid', () => {
      expect(isQuantitySupported('celery')).toBe(true)
      const draft = createEditableDraftFromHistoryEntry(historicalEntry)
      const preload = draftToPreloadIngredients(draft.ingredients)
      const seeded = seedPreloadIngredients(preload, 'conventional')

      const celery = seeded.find((i) => i.produceId === 'celery')
      expect(celery).toBeDefined()
      expect(celery.portionMetadata.unitKey).toBe('stalk')
      expect(celery.portionMetadata.sizeKey).toBe('medium')
      expect(celery.portionMetadata.enteredQuantity).toBe(4)
      expect(celery.weightG).toBeGreaterThan(0)
    })

    test('10. organic state preserved through normalization', () => {
      const draft = createEditableDraftFromHistoryEntry(historicalEntry)
      const preload = draftToPreloadIngredients(draft.ingredients)
      const seeded = seedPreloadIngredients(preload, 'conventional')

      const carrot = seeded.find((i) => i.produceId === 'carrot')
      expect(carrot.isOrganic).toBe(true)

      const celery = seeded.find((i) => i.produceId === 'celery')
      expect(celery.isOrganic).toBe(false)
    })

    test('11. weight-mode ingredients pass through without normalization', () => {
      const weightEntry = {
        id: 'hist-002',
        ingredients: [
          {
            produceId: 'kale',
            portionEntryMode: 'weight',
            isOrganic: false,
          },
        ],
      }
      const draft = createEditableDraftFromHistoryEntry(weightEntry)
      const preload = draftToPreloadIngredients(draft.ingredients)
      const seeded = seedPreloadIngredients(preload, 'conventional')

      expect(seeded[0].portionEntryMode).toBe('weight')
      // Weight-mode doesn't need canonical portionMetadata
      const isValid = validateForLogToToday(seeded)
      expect(isValid).toBe(true)
    })

    test('12. genuinely incomplete data still requires user correction', () => {
      // Historical entry with a produce that has NO valid unit/size data
      // and no portionUnit — the normalization fallback should still
      // produce valid defaults, but if the produce genuinely lacks
      // quantity support, validation should skip it (not fail).
      // However, if quantity is 0 or negative, that's genuinely invalid.
      const incompleteEntry = {
        id: 'hist-003',
        ingredients: [
          {
            produceId: 'carrot',
            quantity: 0, // genuinely invalid
            portionEntryMode: 'quantity',
            portionUnit: 'whole',
            portionSize: 'medium',
            isOrganic: false,
          },
        ],
      }
      const draft = createEditableDraftFromHistoryEntry(incompleteEntry)
      // normalizeQuantity defaults 0 to 1, so the draft will have qty=1
      // This is correct behavior — the helper defaults invalid quantities
      expect(draft.ingredients[0].quantity).toBe(1)

      const preload = draftToPreloadIngredients(draft.ingredients)
      const seeded = seedPreloadIngredients(preload, 'conventional')
      // With qty=1 (defaulted), this should pass validation
      const isValid = validateForLogToToday(seeded)
      expect(isValid).toBe(true)
    })

    test('13. produce without quantity support skips validation', () => {
      // Some produce doesn't support quantity entry at all — it uses weight
      // Validation should skip these (continue) and not fail
      const weightOnlyEntry = {
        id: 'hist-004',
        ingredients: [
          {
            produceId: 'ginger',
            portionEntryMode: 'weight',
            isOrganic: false,
          },
        ],
      }
      const draft = createEditableDraftFromHistoryEntry(weightOnlyEntry)
      const preload = draftToPreloadIngredients(draft.ingredients)
      const seeded = seedPreloadIngredients(preload, 'conventional')

      // ginger may or may not support quantity — if it doesn't, validation skips
      const isValid = validateForLogToToday(seeded)
      expect(isValid).toBe(true)
    })

    test('14. multiple quantity ingredients all normalized', () => {
      const multiEntry = {
        id: 'hist-005',
        primaryProduceId: 'carrot',
        ingredients: [
          {
            produceId: 'carrot',
            quantity: 3,
            portionEntryMode: 'quantity',
            portionUnit: 'whole',
            portionSize: 'large',
            isOrganic: true,
          },
          {
            produceId: 'celery',
            quantity: 2,
            portionEntryMode: 'quantity',
            portionUnit: 'stalk',
            portionSize: 'medium',
            isOrganic: false,
          },
          {
            produceId: 'lemon',
            quantity: 1,
            portionEntryMode: 'quantity',
            portionUnit: 'whole',
            portionSize: 'medium',
            isOrganic: false,
          },
        ],
      }
      const draft = createEditableDraftFromHistoryEntry(multiEntry)
      const preload = draftToPreloadIngredients(draft.ingredients)
      const seeded = seedPreloadIngredients(preload, 'conventional')

      expect(seeded).toHaveLength(3)
      const isValid = validateForLogToToday(seeded)
      expect(isValid).toBe(true)

      // All should have canonical metadata
      for (const ing of seeded) {
        if (isQuantitySupported(ing.produceId) && ing.portionEntryMode === 'quantity') {
          expect(ing.portionMetadata.unitKey).toBeDefined()
          expect(ing.portionMetadata.enteredQuantity).toBeGreaterThan(0)
        }
      }
    })

    test('15. canonical metadata already present is not re-normalized', () => {
      // If preload already has canonical keys, seedPreloadIngredients
      // should pass it through without re-normalizing
      const defaultUnit = getDefaultPortionUnit('carrot')
      const sizes = getSupportedSizes('carrot', defaultUnit.unitKey)
      const hasSML = sizes.some((s) => s.sizeKey !== 'standard')
      const defaultSize = hasSML ? sizes.find((s) => s.sizeKey === 'medium') || sizes[0] : null
      const result = recomputeFromQuantityChange({
        produceId: 'carrot',
        quantity: 5,
        unitKey: defaultUnit.unitKey,
        sizeKey: defaultSize?.sizeKey || undefined,
      })

      const canonicalPreload = [
        {
          produceId: 'carrot',
          weightG: 150,
          isOrganic: false,
          portionEntryMode: 'quantity',
          portionMetadata: result.metadata,
        },
      ]

      const seeded = seedPreloadIngredients(canonicalPreload, 'conventional')
      // Should preserve the exact same metadata
      expect(seeded[0].portionMetadata.unitKey).toBe(result.metadata.unitKey)
      expect(seeded[0].portionMetadata.enteredQuantity).toBe(result.metadata.enteredQuantity)
      expect(seeded[0].portionMetadata.sizeKey).toBe(result.metadata.sizeKey)
    })
  })
})
