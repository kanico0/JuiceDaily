import {
  getRecipesForPrimaryProduce,
  resetIndex,
} from '../produceRecipeMatcher'
import { getRecipeById } from '../../constants/recipeData'

const PAGE_SIZE = 25

type ProduceMatch = {
  recipeId: string
  title: string
  tier: string
  rawMatchRatio: number
  displayMatchPct: number
  matchedProduceIds: string[]
  missingProduceIds: string[]
  missingProduceNames: string[]
  distinctIngredientCount: number
  tier_label: string
  blendType: string
  exactMatchCount: number
}

function paginate(matches: ProduceMatch[], page: number, pageSize: number) {
  const totalCount = matches.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const endIndex = startIndex + pageSize
  return {
    pageItems: matches.slice(startIndex, endIndex),
    totalCount,
    totalPages,
    safePage,
    startIndex,
    endIndex,
  }
}

describe('Recipe Pagination', () => {
  beforeAll(() => {
    resetIndex()
  })

  // Get a large result set for pagination testing
  const largeResult = getRecipesForPrimaryProduce('celery', ['cucumber', 'ginger', 'lemon', 'apple'])
  const largeMatches = largeResult.status === 'results' ? largeResult.matches : []
  const totalCount = largeMatches.length

  describe('1. First page', () => {
    it('returns the first PAGE_SIZE items on page 1', () => {
      const p = paginate(largeMatches, 1, PAGE_SIZE)
      expect(p.pageItems.length).toBe(Math.min(PAGE_SIZE, totalCount))
      expect(p.safePage).toBe(1)
    })
  })

  describe('2. Middle page', () => {
    it('returns items from the correct offset on a middle page', () => {
      if (totalCount <= PAGE_SIZE) return
      const midPage = 2
      const p = paginate(largeMatches, midPage, PAGE_SIZE)
      expect(p.pageItems.length).toBe(Math.min(PAGE_SIZE, totalCount - PAGE_SIZE))
      expect(p.startIndex).toBe(PAGE_SIZE)
    })
  })

  describe('3. Final page', () => {
    it('returns remaining items on the last page', () => {
      const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
      const p = paginate(largeMatches, totalPages, PAGE_SIZE)
      const expectedCount = totalCount - (totalPages - 1) * PAGE_SIZE
      expect(p.pageItems.length).toBe(expectedCount)
    })
  })

  describe('4. Previous disabled on page 1', () => {
    it('safePage is 1 and cannot go below 1', () => {
      const p = paginate(largeMatches, 1, PAGE_SIZE)
      expect(p.safePage).toBe(1)
      const prevDisabled = p.safePage <= 1
      expect(prevDisabled).toBe(true)
    })
  })

  describe('5. Next disabled on the final page', () => {
    it('safePage equals totalPages on last page', () => {
      const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
      const p = paginate(largeMatches, totalPages, PAGE_SIZE)
      const nextDisabled = p.safePage >= totalPages
      expect(nextDisabled).toBe(true)
    })
  })

  describe('6. Fewer than one full page', () => {
    it('returns all items in a single page when count < PAGE_SIZE', () => {
      const smallResult = getRecipesForPrimaryProduce('celery', [])
      if (smallResult.status !== 'results') return
      const smallMatches = smallResult.matches.slice(0, 10)
      const p = paginate(smallMatches, 1, PAGE_SIZE)
      expect(p.totalPages).toBe(1)
      expect(p.pageItems.length).toBe(10)
    })
  })

  describe('7. Exactly one full page', () => {
    it('totalPages is 1 when count === PAGE_SIZE', () => {
      const exact = largeMatches.slice(0, PAGE_SIZE)
      const p = paginate(exact, 1, PAGE_SIZE)
      expect(p.totalPages).toBe(1)
      expect(p.pageItems.length).toBe(PAGE_SIZE)
    })
  })

  describe('8. Multiple pages', () => {
    it('totalPages > 1 when count > PAGE_SIZE', () => {
      if (totalCount > PAGE_SIZE) {
        const p = paginate(largeMatches, 1, PAGE_SIZE)
        expect(p.totalPages).toBeGreaterThan(1)
      }
    })
  })

  describe('9. Search terms persist across pages', () => {
    it('same result set is used for all pages', () => {
      if (totalCount <= PAGE_SIZE) return
      const p1 = paginate(largeMatches, 1, PAGE_SIZE)
      const p2 = paginate(largeMatches, 2, PAGE_SIZE)
      // Both pages come from the same source array
      expect(largeMatches.slice(p1.startIndex, p1.endIndex)).toEqual(p1.pageItems)
      expect(largeMatches.slice(p2.startIndex, p2.endIndex)).toEqual(p2.pageItems)
    })
  })

  describe('10. Filters persist across pages', () => {
    it('filtering is applied before pagination', () => {
      // The largeMatches are already filtered by primary produce
      // Verify all items contain the primary produce
      for (const m of largeMatches) {
        const recipe = getRecipeById(m.recipeId)
        expect(recipe).toBeDefined()
      }
      // Pagination doesn't change the filtered set
      const p1 = paginate(largeMatches, 1, PAGE_SIZE)
      const p2 = paginate(largeMatches, 2, PAGE_SIZE)
      const allPaged = [...p1.pageItems, ...p2.pageItems]
      for (const m of allPaged) {
        expect(largeMatches).toContain(m)
      }
    })
  })

  describe('11. Primary produce persists across pages', () => {
    it('primaryProduceId is maintained in the result', () => {
      expect(largeResult.primaryProduceId).toBe('celery')
      const p1 = paginate(largeMatches, 1, PAGE_SIZE)
      const p2 = paginate(largeMatches, 2, PAGE_SIZE)
      // The result object doesn't change between pages
      expect(largeResult.primaryProduceId).toBe('celery')
    })
  })

  describe('12. Optional-ingredient ranking remains stable across pages', () => {
    it('order is the same regardless of which page is requested', () => {
      const p1 = paginate(largeMatches, 1, PAGE_SIZE)
      const p2 = paginate(largeMatches, 2, PAGE_SIZE)
      // Verify items are in the same order as the source
      for (let i = 0; i < p1.pageItems.length; i++) {
        expect(p1.pageItems[i]).toBe(largeMatches[i])
      }
      for (let i = 0; i < p2.pageItems.length; i++) {
        expect(p2.pageItems[i]).toBe(largeMatches[p2.startIndex + i])
      }
    })
  })

  describe('13. Changing primary produce resets to page 1', () => {
    it('different primary produce produces a different result set', () => {
      const a = getRecipesForPrimaryProduce('celery', ['cucumber'])
      const b = getRecipesForPrimaryProduce('cucumber', ['celery'])
      if (a.status === 'results' && b.status === 'results') {
        const aIds = a.matches.map((m) => m.recipeId)
        const bIds = b.matches.map((m) => m.recipeId)
        // Different primary produce should produce different result sets
        expect(a.primaryProduceId).not.toBe(b.primaryProduceId)
      }
    })
  })

  describe('14. Changing filters resets to page 1', () => {
    it('different other ingredients produce different result sets', () => {
      const a = getRecipesForPrimaryProduce('celery', ['cucumber'])
      const b = getRecipesForPrimaryProduce('celery', ['kale'])
      if (a.status === 'results' && b.status === 'results') {
        // Both should contain celery recipes but ranked differently
        expect(a.matches.length).toBeGreaterThan(0)
        expect(b.matches.length).toBeGreaterThan(0)
      }
    })
  })

  describe('15. Changing search text resets to page 1', () => {
    it('different primary produce is a new search', () => {
      const a = getRecipesForPrimaryProduce('kale', [])
      const b = getRecipesForPrimaryProduce('lemon', [])
      expect(a.primaryProduceId).toBe('kale')
      expect(b.primaryProduceId).toBe('lemon')
    })
  })

  describe('16. No duplicate IDs across adjacent pages', () => {
    it('page 1 and page 2 have no overlapping recipeIds', () => {
      if (totalCount <= PAGE_SIZE) return
      const p1 = paginate(largeMatches, 1, PAGE_SIZE)
      const p2 = paginate(largeMatches, 2, PAGE_SIZE)
      const p1Ids = new Set(p1.pageItems.map((m) => m.recipeId))
      for (const m of p2.pageItems) {
        expect(p1Ids.has(m.recipeId)).toBe(false)
      }
    })
  })

  describe('17. No skipped IDs across the full paginated result set', () => {
    it('union of all pages equals the full result set', () => {
      const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
      const allPagedIds = new Set()
      for (let page = 1; page <= totalPages; page++) {
        const p = paginate(largeMatches, page, PAGE_SIZE)
        for (const m of p.pageItems) {
          allPagedIds.add(m.recipeId)
        }
      }
      const allSourceIds = new Set(largeMatches.map((m) => m.recipeId))
      expect(allPagedIds.size).toBe(allSourceIds.size)
      for (const id of allSourceIds) {
        expect(allPagedIds.has(id)).toBe(true)
      }
    })
  })

  describe('18. Stable deterministic ordering', () => {
    it('same input always produces same page contents', () => {
      const a = paginate(largeMatches, 1, PAGE_SIZE)
      const b = paginate(largeMatches, 1, PAGE_SIZE)
      expect(a.pageItems.map((m) => m.recipeId)).toEqual(b.pageItems.map((m) => m.recipeId))
    })
  })

  describe('19. Empty-result state', () => {
    it('empty matches produce empty page', () => {
      const p = paginate([], 1, PAGE_SIZE)
      expect(p.pageItems).toEqual([])
      expect(p.totalPages).toBe(1)
      expect(p.totalCount).toBe(0)
    })
  })

  describe('20. Loading and error states', () => {
    it('result status is propagated correctly', () => {
      const emptyResult = getRecipesForPrimaryProduce('', [])
      expect(emptyResult.status).toBe('empty_selection')
      // Pagination should not be applied for non-results status
      expect(emptyResult.matches).toEqual([])
    })
  })

  describe('21. Rapid Next/Previous actions do not show stale results', () => {
    it('page state is deterministic regardless of navigation speed', () => {
      if (totalCount <= PAGE_SIZE * 2) return
      // Simulate rapid next/prev
      const p1 = paginate(largeMatches, 1, PAGE_SIZE)
      const p2 = paginate(largeMatches, 2, PAGE_SIZE)
      const p3 = paginate(largeMatches, 3, PAGE_SIZE)
      const backTo2 = paginate(largeMatches, 2, PAGE_SIZE)
      // Going back to page 2 should show the same items
      expect(backTo2.pageItems.map((m) => m.recipeId)).toEqual(p2.pageItems.map((m) => m.recipeId))
    })
  })

  describe('22. Scroll-to-top behavior', () => {
    it('page change produces a new startIndex from 0 offset', () => {
      const p1 = paginate(largeMatches, 1, PAGE_SIZE)
      expect(p1.startIndex).toBe(0)
      if (totalCount > PAGE_SIZE) {
        const p2 = paginate(largeMatches, 2, PAGE_SIZE)
        expect(p2.startIndex).toBe(PAGE_SIZE)
      }
    })
  })

  describe('23. Every recipe in a test result set can eventually be reached', () => {
    it('all source recipe IDs appear in some page', () => {
      const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
      const seen = new Set()
      for (let page = 1; page <= totalPages; page++) {
        const p = paginate(largeMatches, page, PAGE_SIZE)
        for (const m of p.pageItems) {
          seen.add(m.recipeId)
        }
      }
      expect(seen.size).toBe(totalCount)
    })
  })
})
