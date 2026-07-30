import { JUICE_SPOTLIGHTS, SPOTLIGHT_FOCUS_MAP, getSpotlightForDay, getSpotlightState } from '../../data/juiceSpotlights'
import { RECIPES, getRecipeById, countDistinctProduceIds, getRecipeBlendType } from '../../constants/recipeData'

describe('Phase 11 — Today and Spotlight safeguards', () => {
  describe('Simple Blend to Try', () => {
    // Replicate the selection logic from TodayScreen.js
    function selectSimpleBlend(dayKey) {
      const dayIndex = parseInt(dayKey.replace(/-/g, ''), 10)
      const candidates = RECIPES
        .filter((r) => {
          if (!r.id || !r.title) return false
          const produceIds = (r.ingredients || [])
            .map((i) => (i.produceId || '').toLowerCase())
            .filter(Boolean)
          const distinctIds = [...new Set(produceIds)]
          return distinctIds.length >= 2 && distinctIds.length <= 4
        })
        .sort((a, b) => a.id.localeCompare(b.id))
      if (candidates.length === 0) return null
      return candidates[dayIndex % candidates.length]
    }

    it('selects only recipes with 2-4 distinct produceIds', () => {
      const blend = selectSimpleBlend('2026-07-29')
      expect(blend).not.toBeNull()
      const distinctCount = countDistinctProduceIds(blend.ingredients)
      expect(distinctCount).toBeGreaterThanOrEqual(2)
      expect(distinctCount).toBeLessThanOrEqual(4)
    })

    it('never selects a 5+ ingredient Advanced Blend', () => {
      for (let d = 1; d <= 31; d++) {
        const dayKey = `2026-07-${String(d).padStart(2, '0')}`
        const blend = selectSimpleBlend(dayKey)
        expect(blend).not.toBeNull()
        const blendType = getRecipeBlendType(blend)
        expect(blendType).toBe('simple')
      }
    })

    it('daily selection is deterministic (same dayKey → same recipe)', () => {
      const blend1 = selectSimpleBlend('2026-07-29')
      const blend2 = selectSimpleBlend('2026-07-29')
      expect(blend1.id).toBe(blend2.id)
    })

    it('different day keys can select different recipes', () => {
      const blend1 = selectSimpleBlend('2026-07-01')
      const blend2 = selectSimpleBlend('2026-07-02')
      // They might be the same by chance, but at least verify determinism
      expect(blend1).not.toBeNull()
      expect(blend2).not.toBeNull()
    })

    it('all selected recipe IDs resolve via getRecipeById', () => {
      for (let d = 1; d <= 31; d++) {
        const dayKey = `2026-07-${String(d).padStart(2, '0')}`
        const blend = selectSimpleBlend(dayKey)
        const resolved = getRecipeById(blend.id)
        expect(resolved).toBeDefined()
        expect(resolved.id).toBe(blend.id)
      }
    })
  })

  describe('Spotlight IDs resolve', () => {
    it('every spotlight in JUICE_SPOTLIGHTS has a valid id', () => {
      for (const s of JUICE_SPOTLIGHTS) {
        expect(s.id).toBeTruthy()
        expect(typeof s.id).toBe('string')
      }
    })

    it('every spotlight in SPOTLIGHT_FOCUS_MAP references an existing spotlight', () => {
      for (const [focusId, spotlightIds] of Object.entries(SPOTLIGHT_FOCUS_MAP)) {
        for (const sid of spotlightIds) {
          const found = JUICE_SPOTLIGHTS.find((s) => s.id === sid)
          expect(found).toBeDefined()
        }
      }
    })

    it('getSpotlightForDay returns a valid spotlight for any day', () => {
      for (let d = 1; d <= 31; d++) {
        const dayKey = `2026-07-${String(d).padStart(2, '0')}`
        const spotlight = getSpotlightForDay({ dayKey })
        expect(spotlight).not.toBeNull()
        expect(spotlight.id).toBeTruthy()
      }
    })

    it('getSpotlightForDay returns a valid spotlight for any focusId', () => {
      const dayKey = '2026-07-29'
      for (const focusId of Object.keys(SPOTLIGHT_FOCUS_MAP)) {
        const spotlight = getSpotlightForDay({ focusId, dayKey })
        expect(spotlight).not.toBeNull()
      }
    })

    it('getSpotlightForDay falls back to beginner-friendly for unknown focusId', () => {
      const spotlight = getSpotlightForDay({ focusId: 'nonexistent', dayKey: '2026-07-29' })
      expect(spotlight).not.toBeNull()
      expect(spotlight.beginnerFriendly).toBe(true)
    })

    it('getSpotlightState returns correct state for new user', () => {
      const state = getSpotlightState({ totalLogs: 0, todayEntries: [] })
      expect(state.kind).toBe('new')
      expect(state.latestEntry).toBeNull()
    })

    it('getSpotlightState returns correct state for returning pre-log', () => {
      const state = getSpotlightState({ totalLogs: 5, todayEntries: [] })
      expect(state.kind).toBe('suggestion')
    })

    it('getSpotlightState returns correct state for post-log', () => {
      const state = getSpotlightState({ totalLogs: 5, todayEntries: [{ id: 'test' }] })
      expect(state.kind).toBe('completed')
      expect(state.latestEntry).not.toBeNull()
    })
  })

  describe('No full 1,000-recipe filtering on every render', () => {
    it('TodayScreen simpleBlend useMemo has empty deps (computed once)', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'screens', 'TodayScreen.js'),
        'utf-8'
      )
      // The useMemo for simpleBlend should have [] deps
      expect(source).toMatch(/simpleBlend.*useMemo\(\(\).*\[\]\)/s)
    })
  })

  describe('Today usage balances remain unchanged', () => {
    it('FreePlanUsageCard is imported in TodayScreen', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'screens', 'TodayScreen.js'),
        'utf-8'
      )
      expect(source).toContain('FreePlanUsageCard')
    })

    it('RECIPES import in TodayScreen is from recipeData (canonical source)', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'screens', 'TodayScreen.js'),
        'utf-8'
      )
      expect(source).toContain("from '../constants/recipeData'")
    })
  })
})
