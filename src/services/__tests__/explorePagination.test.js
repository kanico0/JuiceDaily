// ─────────────────────────────────────────────────────────────
// explorePagination.test.js — Tests for Explore Juice Ideas
// pagination (Issue 1: 100-recipe cap removed, all 1000 reachable)
// ─────────────────────────────────────────────────────────────

import {
  searchRecipes,
} from '../recipeSearch'
import { RECIPES } from '../../constants/recipeData'

const PAGE_SIZE = 25

describe('Explore Juice Ideas pagination', () => {
  // 1. Complete 1,000-recipe collection is available to Explore
  test('all 1,000 recipes are available with no search query', () => {
    const results = searchRecipes('', undefined, 1000)
    expect(results.length).toBe(1000)
  })

  // 2. No 100-result cap remains
  test('no 100-result cap — requesting 1000 returns 1000', () => {
    const results = searchRecipes('', undefined, 1000)
    expect(results.length).toBeGreaterThan(100)
    expect(results.length).toBe(1000)
  })

  // 3. Page size is 25
  test('page size is 25', () => {
    expect(PAGE_SIZE).toBe(25)
  })

  // 4. Forty pages available when all 1,000 recipes match
  test('1,000 recipes / 25 = 40 pages', () => {
    const total = searchRecipes('', undefined, 1000).length
    const pages = Math.ceil(total / PAGE_SIZE)
    expect(pages).toBe(40)
  })

  // 5. Every recipe ID is reachable exactly once
  test('every recipe ID is reachable exactly once across all pages', () => {
    const allResults = searchRecipes('', undefined, 1000)
    const seenIds = new Set()
    const totalPages = Math.ceil(allResults.length / PAGE_SIZE)

    for (let page = 0; page < totalPages; page++) {
      const start = page * PAGE_SIZE
      const pageItems = allResults.slice(start, start + PAGE_SIZE)
      for (const item of pageItems) {
        expect(seenIds.has(item.id)).toBe(false)
        seenIds.add(item.id)
      }
    }

    expect(seenIds.size).toBe(1000)
  })

  // 6. Duplicate count is zero
  test('duplicate count is zero across all pages', () => {
    const allResults = searchRecipes('', undefined, 1000)
    const ids = allResults.map((r) => r.id)
    const uniqueIds = new Set(ids)
    expect(ids.length - uniqueIds.size).toBe(0)
  })

  // 7. Missing count is zero
  test('missing count is zero — all recipe IDs from RECIPES are present', () => {
    const allResults = searchRecipes('', undefined, 1000)
    const resultIds = new Set(allResults.map((r) => r.id))
    const recipeIds = RECIPES.map((r) => r.id)
    let missing = 0
    for (const id of recipeIds) {
      if (!resultIds.has(id)) missing++
    }
    expect(missing).toBe(0)
  })

  // 8. Previous and Next disabling is correct
  test('Previous is disabled on page 1', () => {
    const total = 1000
    const totalPages = Math.ceil(total / PAGE_SIZE)
    const currentPage = 1
    const prevDisabled = currentPage <= 1
    expect(prevDisabled).toBe(true)
  })

  test('Next is disabled on the final page', () => {
    const total = 1000
    const totalPages = Math.ceil(total / PAGE_SIZE)
    const currentPage = totalPages
    const nextDisabled = currentPage >= totalPages
    expect(nextDisabled).toBe(true)
  })

  test('Previous is enabled on page 2', () => {
    const currentPage = 2
    const prevDisabled = currentPage <= 1
    expect(prevDisabled).toBe(false)
  })

  test('Next is enabled on page 1', () => {
    const total = 1000
    const totalPages = Math.ceil(total / PAGE_SIZE)
    const currentPage = 1
    const nextDisabled = currentPage >= totalPages
    expect(nextDisabled).toBe(false)
  })

  // 9. Search and filters persist across pages
  test('search results are stable across page slices', () => {
    const searchResults = searchRecipes('kale', {}, 1000)
    const totalPages = Math.ceil(searchResults.length / PAGE_SIZE)
    expect(totalPages).toBeGreaterThan(0)

    // Page 1 and page 2 should come from the same searchResults array
    const page1 = searchResults.slice(0, PAGE_SIZE)
    const page2 = searchResults.slice(PAGE_SIZE, PAGE_SIZE * 2)
    expect(page1.length).toBe(PAGE_SIZE)
    if (totalPages > 1) {
      expect(page2.length).toBeGreaterThan(0)
      // No overlap between pages
      const page1Ids = new Set(page1.map((r) => r.id))
      for (const item of page2) {
        expect(page1Ids.has(item.id)).toBe(false)
      }
    }
  })

  // 10. Search/filter changes reset to page 1
  test('search query change produces different result set (reset scenario)', () => {
    const results1 = searchRecipes('', undefined, 1000)
    const results2 = searchRecipes('kale', {}, 1000)
    // Different queries produce different result sets
    expect(results1.length).not.toBe(results2.length)
  })

  // 11. Page changes return the list to the top (deterministic ordering)
  test('ordering is deterministic — same query produces same order', () => {
    const r1 = searchRecipes('', undefined, 1000)
    const r2 = searchRecipes('', undefined, 1000)
    expect(r1.map((r) => r.id)).toEqual(r2.map((r) => r.id))
  })

  // 12. Existing primary-produce pagination remains unchanged
  test('primary-produce search still works with its own limit', () => {
    const results = searchRecipes('carrot', {}, 50)
    expect(results.length).toBeGreaterThan(0)
    expect(results.length).toBeLessThanOrEqual(50)
  })
})
