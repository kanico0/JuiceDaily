// ─────────────────────────────────────────────────────────────
// betaQaRound1.test.js — 39 focused tests for QA Round 1 corrections
// Covers all 7 issues plus regression safety checks.
// ─────────────────────────────────────────────────────────────

import React from 'react'
import { Text } from 'react-native'

// ── Source inspection helpers ────────────────────────────────
// Since deep-rendering React Native components requires extensive
// mocking, we use source-text inspection for UI label/layout checks
// and logic-level tests for behavioral assertions.

const fs = require('fs')
const path = require('path')

function readSrc(relPath) {
  const full = path.join(__dirname, '..', relPath)
  return fs.readFileSync(full, 'utf8')
}

const QPE_SRC = readSrc('../components/QuantityPortionEditor.js')
const HOME_SRC = readSrc('../screens/HomeScreen.js')
const TODAY_SRC = readSrc('../screens/TodayScreen.js')
const EXP_SRC = readSrc('../screens/JuicingExperienceScreen.js')
const SCAN_SRC = readSrc('../screens/ScanScreen.js')
const APP_SRC = path.join(__dirname, '..', '..', '..', 'App.js')
const APP_TEXT = fs.readFileSync(APP_SRC, 'utf8')

// ── Issue 1: Adjust raw weight labeling (Round 2: UI removed) ─

describe('Issue 1: Adjust raw weight labeling (Round 2: UI removed)', () => {
  it('1.1 — QuantityPortionEditor no longer renders "Adjust raw weight" button text', () => {
    expect(QPE_SRC).not.toContain('Adjust raw weight')
  })

  it('1.2 — QuantityPortionEditor no longer uses bare "Adjust" as button label', () => {
    expect(QPE_SRC).not.toContain("'Adjust'")
  })

  it('1.3 — Does not show "Adjusted raw weight" (UI removed)', () => {
    expect(QPE_SRC).not.toContain('Adjusted raw weight')
  })

  it('1.4 — Does not have accessibilityLabel "Adjust raw produce weight"', () => {
    expect(QPE_SRC).not.toContain('Adjust raw produce weight')
  })

  it('1.5 — Does not include inline weight editor with Apply button', () => {
    expect(QPE_SRC).not.toContain('adjustEditor')
  })

  it('1.6 — Includes helper text explaining how to change the estimate', () => {
    expect(QPE_SRC).toContain('To change this estimate, adjust the quantity, unit, or size.')
  })

  it('1.7 — Does not have "Reset to estimate" button (UI removed)', () => {
    expect(QPE_SRC).not.toContain('Reset to estimate')
  })

  it('1.8 — Shows read-only "Estimated raw produce weight:" label', () => {
    expect(QPE_SRC).toContain('Estimated raw produce weight:')
  })
})

// ── Issue 2: Stack produce-size choices vertically ──────────

describe('Issue 2: Vertical size selector', () => {
  it('2.1 — Size container uses flexDirection column (not row)', () => {
    expect(QPE_SRC).toContain('sizeContainer')
    const sizeContainerMatch = QPE_SRC.match(/sizeContainer:\s*\{[^}]*flexDirection:\s*'column'/)
    expect(sizeContainerMatch).not.toBeNull()
  })

  it('2.2 — Size options are full-width rows (width: "100%")', () => {
    expect(QPE_SRC).toContain("width: '100%'")
  })

  it('2.3 — Size row items have minHeight >= 44 for touch targets', () => {
    const minHeightMatch = QPE_SRC.match(/sizeRowItem:\s*\{[^}]*minHeight:\s*(\d+)/)
    expect(minHeightMatch).not.toBeNull()
    expect(parseInt(minHeightMatch[1])).toBeGreaterThanOrEqual(44)
  })

  it('2.4 — Selected size shows checkmark', () => {
    expect(QPE_SRC).toContain('sizeCheck')
    expect(QPE_SRC).toContain('✓')
  })

  it('2.5 — Size options have accessibilityState with checked', () => {
    expect(QPE_SRC).toContain('accessibilityState={{ checked: isActive }}')
  })

  it('2.6 — Old horizontal sizeRow style is removed', () => {
    const oldSizeRowMatch = QPE_SRC.match(/sizeRow:\s*\{[^}]*flexDirection:\s*'row'/)
    expect(oldSizeRowMatch).toBeNull()
  })
})

// ── Issue 3: Move 'Find Recipes' below '+ Add Produce' ──────

describe('Issue 3: Find Recipes button placement', () => {
  it('3.1 — Find Recipes button exists in HomeScreen', () => {
    expect(HOME_SRC).toContain('Find Recipes with My Primary Produce')
  })

  it('3.2 — Find Recipes appears after AddProducePicker in source order', () => {
    const addProduceIdx = HOME_SRC.indexOf('AddProducePicker onAdd={handleAddProduce}')
    const findRecipesIdx = HOME_SRC.indexOf('Find Recipes with My Primary Produce')
    expect(addProduceIdx).toBeGreaterThan(-1)
    expect(findRecipesIdx).toBeGreaterThan(-1)
    expect(findRecipesIdx).toBeGreaterThan(addProduceIdx)
  })

  it('3.3 — Find Recipes appears before NutritionSummary in source order', () => {
    const addProduceIdx = HOME_SRC.indexOf('AddProducePicker onAdd={handleAddProduce}')
    const findRecipesIdx = HOME_SRC.indexOf('Find Recipes with My Primary Produce', addProduceIdx)
    const nutritionIdx = HOME_SRC.indexOf('<NutritionSummary')
    expect(findRecipesIdx).toBeGreaterThan(-1)
    expect(nutritionIdx).toBeGreaterThan(-1)
    expect(findRecipesIdx).toBeLessThan(nutritionIdx)
  })

  it('3.4 — Only one Find Recipes button block exists (no duplicate)', () => {
    const matches = HOME_SRC.match(/Find Recipes with My Primary Produce/g)
    expect(matches).toHaveLength(1)
  })

  it('3.5 — Find Recipes has accessibilityLabel', () => {
    expect(HOME_SRC).toContain(
      "accessibilityLabel={primaryProduceId ? 'Find recipes with my primary produce' : 'Select a primary produce to find recipes'}",
    )
  })
})

// ── Issue 4: Return path to juicing experience from Today ───

describe('Issue 4: Today screen discovery card for juicing experience', () => {
  it('4.1 — TodayScreen has "Explore Juicing Lessons" card', () => {
    expect(TODAY_SRC).toContain('Explore Juicing Lessons')
  })

  it('4.2 — TodayScreen has "Browse Lessons" CTA', () => {
    expect(TODAY_SRC).toContain('Browse Lessons')
  })

  it('4.3 — TodayScreen navigates to JuicingExperience via getParent', () => {
    expect(TODAY_SRC).toContain("parent.navigate('JuicingExperience')")
  })

  it('4.4 — Discovery card has accessibilityLabel', () => {
    expect(TODAY_SRC).toContain('accessibilityLabel="Explore Juicing Lessons"')
  })

  it('4.5 — JuicingExperienceScreen has styles for discovery card', () => {
    expect(TODAY_SRC).toContain('juicingDiscoveryCard')
  })

  it('4.6 — App.js handles returning users by showing lesson via navigate', () => {
    expect(APP_TEXT).toContain('isReturning')
    expect(APP_TEXT).toContain("navigation.navigate('Lesson'")
  })
})

// ── Issue 5: Experience selection screen copy improvements ──

describe('Issue 5: Experience screen copy and CTAs', () => {
  it('5.1 — Title asks "Where are you on your juicing journey?"', () => {
    expect(EXP_SRC).toContain('Where are you on your juicing journey?')
  })

  it('5.2 — Subtitle mentions "no wrong answer"', () => {
    expect(EXP_SRC).toContain('no wrong answer')
  })

  it('5.3 — New juicer card has CTA "Help Me Get Started"', () => {
    expect(EXP_SRC).toContain('Help Me Get Started')
  })

  it('5.4 — Casual juicer card has CTA "Keep It Simple"', () => {
    expect(EXP_SRC).toContain('Keep It Simple')
  })

  it('5.5 — Experienced juicer card has CTA "Show Me More"', () => {
    expect(EXP_SRC).toContain('Show Me More')
  })

  it('5.6 — New juicer description mentions "simple blends" and "step-by-step"', () => {
    expect(EXP_SRC).toContain('simple blends')
    expect(EXP_SRC).toContain('step-by-step')
  })

  it('5.7 — Experienced juicer description mentions "advanced blends"', () => {
    expect(EXP_SRC).toContain('advanced blends')
  })

  it('5.8 — cardCta style is defined', () => {
    expect(EXP_SRC).toContain('cardCta:')
  })
})

// ── Issue 6: Permanent Search Tips ──────────────────────────

describe('Issue 6: Permanent search tips on ingredient search', () => {
  it('6.1 — HomeScreen has searchTipsCard section', () => {
    expect(HOME_SRC).toContain('searchTipsCard')
  })

  it('6.2 — Search tips title says "If no ingredients matched your search…"', () => {
    expect(HOME_SRC).toContain('If no ingredients matched your search')
  })

  it('6.3 — Tips include spelling advice', () => {
    expect(HOME_SRC).toContain('Check the spelling carefully')
  })

  it('6.4 — Tips include shorter/general name advice', () => {
    expect(HOME_SRC).toContain('shorter or more general')
  })

  it('6.5 — Tips include pepper example', () => {
    expect(HOME_SRC).toContain('pepper')
  })

  it('6.6 — Tips include familiar produce examples', () => {
    expect(HOME_SRC).toContain('spinach')
    expect(HOME_SRC).toContain('carrot')
    expect(HOME_SRC).toContain('kale')
  })

  it('6.7 — Tips are always visible (not conditional on searchQuery)', () => {
    const tipsIdx = HOME_SRC.indexOf('searchTipsCard')
    const beforeTips = HOME_SRC.substring(0, tipsIdx)
    const lastConditional = beforeTips.lastIndexOf('{filtered.length === 0')
    const tipsBlock = HOME_SRC.substring(tipsIdx - 200, tipsIdx + 500)
    expect(tipsBlock).not.toContain('filtered.length === 0')
  })

  it('6.8 — KeyboardAvoidingView is imported', () => {
    expect(HOME_SRC).toContain('KeyboardAvoidingView')
  })
})

// ── Issue 7: Android hardware Back navigation fix ───────────

describe('Issue 7: Android Back navigation for modals', () => {
  it('7.1 — ScanScreen imports BackHandler', () => {
    expect(SCAN_SRC).toContain('BackHandler')
  })

  it('7.2 — ScanScreen has hardwareBackPress listener', () => {
    expect(SCAN_SRC).toContain('hardwareBackPress')
  })

  it('7.3 — Back handler closes showBrowseModal when open', () => {
    expect(SCAN_SRC).toContain('setShowBrowseModal(false)')
  })

  it('7.4 — Back handler closes showExample when open', () => {
    expect(SCAN_SRC).toContain('setShowExample(false)')
  })

  it('7.5 — Back handler returns true to prevent default behavior', () => {
    const backHandlerBlock = SCAN_SRC.match(
      /BackHandler\.addEventListener\('hardwareBackPress'[\s\S]*?\}\)/,
    )
    expect(backHandlerBlock).not.toBeNull()
    expect(backHandlerBlock[0]).toContain('return true')
  })

  it('7.6 — Back handler returns false when no modal is open', () => {
    const backHandlerBlock = SCAN_SRC.match(
      /BackHandler\.addEventListener\('hardwareBackPress'[\s\S]*?\}\)/,
    )
    expect(backHandlerBlock).not.toBeNull()
    expect(backHandlerBlock[0]).toContain('return false')
  })

  it('7.7 — Listener cleanup on unmount (backHandler.remove)', () => {
    expect(SCAN_SRC).toContain('backHandler.remove()')
  })

  it('7.8 — Only one BackHandler listener (no duplicates)', () => {
    const matches = SCAN_SRC.match(/BackHandler\.addEventListener/g)
    expect(matches).toHaveLength(1)
  })
})

// ── Regression: No data/formula/portion changes ──────────────

describe('Regression: Data and formula preservation', () => {
  it('R1 — producePortionConversion still exports estimateRawWeightGrams', () => {
    const convSrc = fs.readFileSync(
      path.join(__dirname, '..', '..', 'services', 'producePortionConversion.ts'),
      'utf8',
    )
    expect(convSrc).toContain('export function estimateRawWeightGrams')
  })

  it('R2 — GRAMS_PER_OZ constant still exported', () => {
    const convSrc = fs.readFileSync(
      path.join(__dirname, '..', '..', 'services', 'producePortionConversion.ts'),
      'utf8',
    )
    expect(convSrc).toContain('GRAMS_PER_OZ')
  })

  it('R3 — ChallengeStore logJuice preserves portionMetadata', () => {
    const csSrc = fs.readFileSync(
      path.join(__dirname, '..', '..', 'services', 'ChallengeStore.js'),
      'utf8',
    )
    expect(csSrc).toContain('portionMetadata')
  })

  it('R4 — RecipeDetailScreen preserves portion metadata in preload', () => {
    const rdSrc = fs.readFileSync(
      path.join(__dirname, '..', '..', 'screens', 'RecipeDetailScreen.js'),
      'utf8',
    )
    expect(rdSrc).toContain('portionMetadata')
  })

  it('R5 — HomeScreen still has handleWeightChange for weight mode', () => {
    expect(HOME_SRC).toContain('handleWeightChange')
  })

  it('R6 — HomeScreen still has handleModeChange for portion mode toggle', () => {
    expect(HOME_SRC).toContain('handleModeChange')
  })

  it('R7 — HomeScreen still has handleQuantityChange for quantity mode', () => {
    expect(HOME_SRC).toContain('handleQuantityChange')
  })

  it('R8 — HomeScreen no longer has handleOverrideWeight (removed in Round 2)', () => {
    expect(HOME_SRC).not.toContain('handleOverrideWeight')
  })

  it('R9 — JuicingExperienceScreen still exports default component', () => {
    expect(EXP_SRC).toContain('export default function JuicingExperienceScreen')
  })

  it('R10 — JuicingExperienceScreen still calls onSelect for all three levels', () => {
    expect(EXP_SRC).toContain("handleSelect('new')")
    expect(EXP_SRC).toContain("handleSelect('casual')")
    expect(EXP_SRC).toContain("handleSelect('experienced')")
  })

  it('R11 — App version bumped to 1.0.19', () => {
    const appJson = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'app.json'), 'utf8')
    expect(appJson).toContain('"version": "1.0.19"')
  })

  it('R12 — ScanScreen still has BrowseIdeasModal and ExampleScanModal', () => {
    expect(SCAN_SRC).toContain('BrowseIdeasModal')
    expect(SCAN_SRC).toContain('ExampleScanModal')
  })
})
