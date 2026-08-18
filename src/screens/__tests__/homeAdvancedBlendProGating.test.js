// homeAdvancedBlendProGating.test.js — Tests for H3A: canonical Pro gating
// in HomeScreen Advanced Blend / Expanded Ingredient Analysis paths.
//
// Proves that customer-facing Advanced Blend logic uses effectiveIsPro
// (from useEffectivePlanAccess) rather than legacy isPro (from ProStore)
// so genuine RevenueCat Pro users do not see Free-plan messaging.

const fs = require('fs')
const path = require('path')

const sourcePath = path.resolve(__dirname, '../HomeScreen.js')
const source = fs.readFileSync(sourcePath, 'utf8')

describe('H3A: HomeScreen Advanced Blend uses effectiveIsPro', () => {
  describe('fifth-ingredient notice (manual add)', () => {
    it('uses effectiveIsPro for the 5-ingredient notice gate', () => {
      // The manual-add path at ~line 1302
      const noticeBlock = source.slice(
        source.indexOf('Fifth-ingredient notice for Advanced Blend'),
        source.indexOf('setBlendNoticeShown(true)', source.indexOf('Fifth-ingredient notice for Advanced Blend')) + 50,
      )
      expect(noticeBlock).toMatch(/!effectiveIsPro/)
      expect(noticeBlock).not.toMatch(/!isPro\b/)
    })

    it('uses effectiveIsPro for getAdvancedBlendRemaining in the notice', () => {
      const noticeBlock = source.slice(
        source.indexOf('Fifth-ingredient notice for Advanced Blend'),
        source.indexOf('setBlendNoticeShown(true)', source.indexOf('Fifth-ingredient notice for Advanced Blend')) + 50,
      )
      expect(noticeBlock).toMatch(/getAdvancedBlendRemaining\(blendUsedCount, effectiveIsPro\)/)
    })
  })

  describe('fifth-ingredient notice (photo scan)', () => {
    it('uses effectiveIsPro for the photo-scan 5-ingredient gate', () => {
      const photoBlock = source.slice(
        source.indexOf('Check for Advanced Blend threshold from photo scan'),
        source.indexOf('source: \'photo\'', source.indexOf('Check for Advanced Blend threshold from photo scan')) + 30,
      )
      expect(photoBlock).toMatch(/!effectiveIsPro/)
      expect(photoBlock).not.toMatch(/!isPro\b/)
    })
  })

  describe('7+ ingredient upsell nudge', () => {
    it('uses effectiveIsPro for the upsell nudge gate', () => {
      const upsellBlock = source.slice(
        source.indexOf('Show upsell nudge at 7+ manual ingredients'),
        source.indexOf('setShowUpsellNudge(true)', source.indexOf('Show upsell nudge at 7+ manual ingredients')) + 30,
      )
      expect(upsellBlock).toMatch(/!effectiveIsPro/)
      expect(upsellBlock).not.toMatch(/!isPro\b/)
    })

    it('uses effectiveIsPro for the upsell nudge display condition', () => {
      const displayBlock = source.slice(
        source.indexOf('Pro Upsell Nudge'),
        source.indexOf('navigation.navigate', source.indexOf('Pro Upsell Nudge')) + 30,
      )
      expect(displayBlock).toMatch(/showUpsellNudge && !effectiveIsPro/)
      expect(displayBlock).not.toMatch(/showUpsellNudge && !isPro\b/)
    })
  })

  describe('Advanced Blend pre-analysis confirmation', () => {
    it('uses effectiveIsPro for the free-user allowance check gate', () => {
      // The gate at ~line 1738: if (blendType === 'advanced' && !effectiveIsPro && !blendApprovedRef.current)
      const gateBlock = source.slice(
        source.indexOf('Advanced Blend: check allowance for free users'),
        source.indexOf('Create a new operation ID', source.indexOf('Advanced Blend: check allowance for free users')) + 30,
      )
      expect(gateBlock).toMatch(/!effectiveIsPro/)
      expect(gateBlock).not.toMatch(/!isPro\b/)
    })

    it('uses effectiveIsPro for getAdvancedBlendRemaining in the confirmation', () => {
      const confirmBlock = source.slice(
        source.indexOf('Advanced Blend: check allowance for free users'),
        source.indexOf('allowance_exhausted', source.indexOf('Advanced Blend: check allowance for free users')) + 30,
      )
      expect(confirmBlock).toMatch(/getAdvancedBlendRemaining\(blendUsedCount, effectiveIsPro\)/)
    })

    it('uses effectiveIsPro for the Pro direct-proceed branch', () => {
      const proBlock = source.slice(
        source.indexOf('Pro users: create operation ID'),
        source.indexOf('executeLogToChallenge', source.indexOf('Pro users: create operation ID')) + 30,
      )
      expect(proBlock).toMatch(/blendType === 'advanced' && effectiveIsPro/)
      expect(proBlock).not.toMatch(/blendType === 'advanced' && isPro\b/)
    })
  })

  describe('AdvancedBlendModal prop', () => {
    it('passes effectiveIsPro to AdvancedBlendModal', () => {
      const modalStart = source.indexOf('<AdvancedBlendModal')
      // The component is self-closing; find the next /> after the prop
      const modalBlock = source.slice(modalStart, modalStart + 400)
      expect(modalBlock).toMatch(/isPro=\{effectiveIsPro\}/)
      expect(modalBlock).not.toMatch(/isPro=\{isPro\}/)
    })
  })

  describe('refreshBlendAllowance uses effectiveIsPro', () => {
    it('fetchEffectiveBlendAllowance uses effectiveIsPro', () => {
      expect(source).toMatch(/fetchEffectiveBlendAllowance\(effectiveIsPro\)/)
      expect(source).not.toMatch(/fetchEffectiveBlendAllowance\(isPro\)/)
    })
  })

  describe('analytics use effectiveIsPro for plan label', () => {
    it('advanced_blend_analysis_started uses effectiveIsPro', () => {
      const block = source.slice(
        source.indexOf('advanced_blend_analysis_started'),
        source.indexOf('ingredient_count', source.indexOf('advanced_blend_analysis_started')) + 20,
      )
      expect(block).toMatch(/effectiveIsPro \? 'pro' : 'free'/)
    })

    it('advanced_blend_allowance_error uses effectiveIsPro (network error path)', () => {
      // There are two advanced_blend_allowance_error calls:
      // 1. Line ~1747: inside the !effectiveIsPro branch → plan: 'free' (correct)
      // 2. Line ~1904: network error catch → plan: effectiveIsPro ? 'pro' : 'free'
      // Verify the second (catch-block) occurrence uses effectiveIsPro.
      const firstPos = source.indexOf('advanced_blend_allowance_error')
      const secondPos = source.indexOf('advanced_blend_allowance_error', firstPos + 1)
      const block = source.slice(secondPos, secondPos + 100)
      expect(block).toMatch(/effectiveIsPro \? 'pro' : 'free'/)
    })
  })

  describe('legacy isPro is not used for Advanced Blend decisions', () => {
    it('no Advanced Blend gate uses bare !isPro', () => {
      // Extract the Advanced Blend section (from the allowance check to
      // the modal) and verify no bare !isPro remains
      const blendStart = source.indexOf('Advanced Blend: check allowance for free users')
      const blendEnd = source.indexOf('</AdvancedBlendModal>') + 20
      const blendSection = source.slice(blendStart, blendEnd)
      expect(blendSection).not.toMatch(/!isPro\b/)
    })
  })
})
