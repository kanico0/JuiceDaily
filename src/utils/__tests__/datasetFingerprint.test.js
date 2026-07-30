import { computeDatasetFingerprint } from '../../utils/datasetFingerprint'

function makeRecipe(id, produceIds, description = 'A refreshing juice') {
  return {
    id,
    title: `Recipe ${id}`,
    description,
    ingredients: produceIds.map((pid) => ({
      produceId: pid,
      name: pid,
      amount: '1 cup',
      ratio: 1 / produceIds.length,
      color: '#00ff00',
    })),
  }
}

describe('computeDatasetFingerprint', () => {
  describe('determinism', () => {
    it('produces the same fingerprint for the same input', () => {
      const recipes = [
        makeRecipe('r1', ['apple', 'kale']),
        makeRecipe('r2', ['beet', 'carrot']),
      ]
      const fp1 = computeDatasetFingerprint(recipes)
      const fp2 = computeDatasetFingerprint(recipes)
      expect(fp1).toBe(fp2)
    })

    it('produces the same fingerprint regardless of ingredient order within a recipe', () => {
      const r1 = makeRecipe('r1', ['apple', 'kale'])
      const r1Reordered = makeRecipe('r1', ['kale', 'apple'])

      const recipesA = [r1, makeRecipe('r2', ['beet', 'carrot'])]
      const recipesB = [r1Reordered, makeRecipe('r2', ['beet', 'carrot'])]

      expect(computeDatasetFingerprint(recipesA)).toBe(computeDatasetFingerprint(recipesB))
    })

  })

  describe('content sensitivity', () => {
    it('produces a different fingerprint when produceIds change but recipe IDs stay the same', () => {
      const recipesA = [
        makeRecipe('r1', ['apple', 'kale']),
        makeRecipe('r2', ['beet', 'carrot']),
      ]
      const recipesB = [
        makeRecipe('r1', ['apple', 'spinach']),
        makeRecipe('r2', ['beet', 'carrot']),
      ]

      expect(computeDatasetFingerprint(recipesA)).not.toBe(computeDatasetFingerprint(recipesB))
    })

    it('produces a different fingerprint when a produceId is added (same IDs, same count)', () => {
      const recipesA = [
        makeRecipe('r1', ['apple', 'kale']),
        makeRecipe('r2', ['beet', 'carrot']),
      ]
      const recipesB = [
        makeRecipe('r1', ['apple', 'kale', 'lemon']),
        makeRecipe('r2', ['beet', 'carrot']),
      ]

      expect(computeDatasetFingerprint(recipesA)).not.toBe(computeDatasetFingerprint(recipesB))
    })

    it('produces a different fingerprint when same IDs and same count but different produceIds', () => {
      const recipesA = [
        makeRecipe('r1', ['apple', 'kale']),
        makeRecipe('r2', ['beet', 'carrot']),
      ]
      const recipesB = [
        makeRecipe('r1', ['apple', 'kale']),
        makeRecipe('r2', ['beet', 'spinach']),
      ]

      // Same recipe count (2), same recipe IDs, but different produceIds
      expect(computeDatasetFingerprint(recipesA)).not.toBe(computeDatasetFingerprint(recipesB))
    })
  })

  describe('display-only fields do not affect fingerprint', () => {
    it('changing only the description does not change the fingerprint', () => {
      const recipesA = [
        makeRecipe('r1', ['apple', 'kale'], 'A refreshing juice'),
        makeRecipe('r2', ['beet', 'carrot'], 'An earthy blend'),
      ]
      const recipesB = [
        makeRecipe('r1', ['apple', 'kale'], 'A completely different description'),
        makeRecipe('r2', ['beet', 'carrot'], 'Another new description'),
      ]

      expect(computeDatasetFingerprint(recipesA)).toBe(computeDatasetFingerprint(recipesB))
    })

    it('changing only the title does not change the fingerprint', () => {
      const recipesA = [
        { ...makeRecipe('r1', ['apple', 'kale']), title: 'Green Glow' },
        { ...makeRecipe('r2', ['beet', 'carrot']), title: 'Red Root' },
      ]
      const recipesB = [
        { ...makeRecipe('r1', ['apple', 'kale']), title: 'Completely New Title' },
        { ...makeRecipe('r2', ['beet', 'carrot']), title: 'Another New Title' },
      ]

      expect(computeDatasetFingerprint(recipesA)).toBe(computeDatasetFingerprint(recipesB))
    })

    it('changing only the vibeTag does not change the fingerprint', () => {
      const recipesA = [
        { ...makeRecipe('r1', ['apple', 'kale']), vibeTag: 'Energizing' },
        { ...makeRecipe('r2', ['beet', 'carrot']), vibeTag: 'Earthy' },
      ]
      const recipesB = [
        { ...makeRecipe('r1', ['apple', 'kale']), vibeTag: 'Different Vibe' },
        { ...makeRecipe('r2', ['beet', 'carrot']), vibeTag: 'Another Vibe' },
      ]

      expect(computeDatasetFingerprint(recipesA)).toBe(computeDatasetFingerprint(recipesB))
    })
  })

  describe('case insensitivity', () => {
    it('treats produceId case variations as the same', () => {
      const recipesA = [
        makeRecipe('r1', ['Apple', 'Kale']),
        makeRecipe('r2', ['Beet', 'Carrot']),
      ]
      const recipesB = [
        makeRecipe('r1', ['apple', 'kale']),
        makeRecipe('r2', ['beet', 'carrot']),
      ]

      expect(computeDatasetFingerprint(recipesA)).toBe(computeDatasetFingerprint(recipesB))
    })
  })

  describe('output format', () => {
    it('produces a 64-character hex string', () => {
      const recipes = [makeRecipe('r1', ['apple', 'kale'])]
      const fp = computeDatasetFingerprint(recipes)
      expect(fp).toMatch(/^[0-9a-f]{64}$/)
    })
  })
})
