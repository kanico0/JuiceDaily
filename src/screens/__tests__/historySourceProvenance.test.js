// ─────────────────────────────────────────────────────────────
// historySourceProvenance.test.js — Regression tests for History
// entry source provenance. Verifies that each creation path maps
// to the correct source value, and that legacy/unknown entries
// are never falsely labeled Juice Snap.
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

function readSrc(relPath) {
  return fs.readFileSync(path.join(__dirname, relPath), 'utf8')
}

const JUICE_LOG_STORE_SRC = readSrc('../../services/JuiceLogStore.js')
const HOME_SCREEN_SRC = readSrc('../../screens/HomeScreen.js')
const HISTORY_SCREEN_SRC = readSrc('../../screens/HistoryScreen.js')
const RECIPE_DETAIL_SRC = readSrc('../../screens/RecipeDetailScreen.js')
const WELLNESS_RESULTS_SRC = readSrc('../../screens/WellnessResultsScreen.js')
const TODAY_SCREEN_SRC = readSrc('../../screens/TodayScreen.js')
const FOCUS_NUTRIENT_CARD_SRC = readSrc('../../components/FocusNutrientCard.js')

// ── 1. JuiceLogStore default source ───────────────────────────

describe('History Provenance — JuiceLogStore defaults', () => {
  test('default source is "unknown" (not "photo")', () => {
    expect(JUICE_LOG_STORE_SRC).toContain("source: source || 'unknown'")
    expect(JUICE_LOG_STORE_SRC).not.toContain("source: source || 'photo'")
  })

  test('comment documents new source values', () => {
    expect(JUICE_LOG_STORE_SRC).toContain('juice_snap')
    expect(JUICE_LOG_STORE_SRC).toContain('wellness_focus')
    expect(JUICE_LOG_STORE_SRC).toContain('browse_ideas')
    expect(JUICE_LOG_STORE_SRC).toContain('todays_focus')
    expect(JUICE_LOG_STORE_SRC).toContain('today_spotlight')
    expect(JUICE_LOG_STORE_SRC).toContain('make_again')
    expect(JUICE_LOG_STORE_SRC).toContain('unknown')
  })
})

// ── 2. HomeScreen logSource mapping ───────────────────────────

describe('History Provenance — HomeScreen source resolution', () => {
  test('has resolveLogSource function', () => {
    expect(HOME_SCREEN_SRC).toContain('function resolveLogSource')
  })

  test('has ROUTE_SOURCE_TO_LOG_SOURCE mapping', () => {
    expect(HOME_SCREEN_SRC).toContain('ROUTE_SOURCE_TO_LOG_SOURCE')
    expect(HOME_SCREEN_SRC).toContain("camera: 'juice_snap'")
    expect(HOME_SCREEN_SRC).toContain("recipe: 'browse_ideas'")
    expect(HOME_SCREEN_SRC).toContain("spotlight: 'today_spotlight'")
    expect(HOME_SCREEN_SRC).toContain("todays_focus: 'todays_focus'")
    expect(HOME_SCREEN_SRC).toContain("history_make_again: 'make_again'")
    expect(HOME_SCREEN_SRC).toContain("checkin: 'manual'")
  })

  test('camera usage overrides recipe origin', () => {
    expect(HOME_SCREEN_SRC).toContain('if (cameraUsed) return \'juice_snap\'')
  })

  test('has cameraUsedRef for tracking camera pathway', () => {
    expect(HOME_SCREEN_SRC).toContain('cameraUsedRef')
  })

  test('cameraUsedRef set to true in handleProduceIdentified', () => {
    const section = HOME_SCREEN_SRC.match(/handleProduceIdentified = useCallback\([\s\S]*?\n  \}/)
    expect(section).toBeTruthy()
    expect(section[0]).toContain('cameraUsedRef.current = true')
  })

  test('cameraUsedRef reset on new preload', () => {
    const preloadEffect = HOME_SCREEN_SRC.match(/Reseed batch[\s\S]*?\}, \[route\?\.params\?\.preloadIngredients\]/)
    expect(preloadEffect).toBeTruthy()
    expect(preloadEffect[0]).toContain('cameraUsedRef.current = false')
  })

  test('executeLogToChallenge uses resolveLogSource (not binary manual/photo)', () => {
    expect(HOME_SCREEN_SRC).toContain('resolveLogSource(source, cameraUsedRef.current, effectiveManualMode)')
    // Old binary logic should NOT be present for the log entry source
    expect(HOME_SCREEN_SRC).not.toContain("const logSource = effectiveManualMode ? 'manual' : 'photo'")
  })

  test('manual entry without camera → manual source', () => {
    expect(HOME_SCREEN_SRC).toContain("if (manualEntry) return 'manual'")
  })

  test('unknown fallback → unknown source (not photo)', () => {
    expect(HOME_SCREEN_SRC).toContain("return 'unknown'")
  })
})

// ── 3. HistoryScreen display mapping ──────────────────────────

describe('History Provenance — HistoryScreen display', () => {
  test('has SOURCE_ICON map with all provenance values', () => {
    expect(HISTORY_SCREEN_SRC).toContain('juice_snap: Camera')
    expect(HISTORY_SCREEN_SRC).toContain('manual: Keyboard')
    expect(HISTORY_SCREEN_SRC).toContain('wellness_focus: Heart')
    expect(HISTORY_SCREEN_SRC).toContain('browse_ideas: BookOpen')
    expect(HISTORY_SCREEN_SRC).toContain('todays_focus: Target')
    expect(HISTORY_SCREEN_SRC).toContain('today_spotlight: Compass')
    expect(HISTORY_SCREEN_SRC).toContain('make_again: RefreshCw')
    expect(HISTORY_SCREEN_SRC).toContain('unknown: Droplets')
  })

  test('has SOURCE_LABEL map with user-facing labels', () => {
    expect(HISTORY_SCREEN_SRC).toContain("juice_snap: 'Juice Snap'")
    expect(HISTORY_SCREEN_SRC).toContain("manual: 'Manual Entry'")
    expect(HISTORY_SCREEN_SRC).toContain("wellness_focus: 'Wellness Focus'")
    expect(HISTORY_SCREEN_SRC).toContain("browse_ideas: 'Browse Juice Ideas'")
    expect(HISTORY_SCREEN_SRC).toContain("todays_focus: \"Today's Focus\"")
    expect(HISTORY_SCREEN_SRC).toContain("today_spotlight: \"Today's Juice Spotlight\"")
    expect(HISTORY_SCREEN_SRC).toContain("make_again: 'Made Again'")
    expect(HISTORY_SCREEN_SRC).toContain("unknown: 'Juice Entry'")
  })

  test('legacy photo maps to neutral (not Camera)', () => {
    expect(HISTORY_SCREEN_SRC).toContain('photo: Droplets')
    expect(HISTORY_SCREEN_SRC).toContain("photo: 'Juice Entry'")
  })

  test('fallback icon is neutral (Droplets), NOT Camera', () => {
    expect(HISTORY_SCREEN_SRC).toContain('NEUTRAL_ICON = Droplets')
    // Old fallback to Camera should NOT be present
    expect(HISTORY_SCREEN_SRC).not.toContain('SOURCE_ICON[entry.source] || Camera')
  })

  test('uses getSourceIcon/getSourceColor/getSourceLabel helpers', () => {
    expect(HISTORY_SCREEN_SRC).toContain('function getSourceIcon')
    expect(HISTORY_SCREEN_SRC).toContain('function getSourceColor')
    expect(HISTORY_SCREEN_SRC).toContain('function getSourceLabel')
  })

  test('Entry Details shows source icon + label (not raw source text)', () => {
    expect(HISTORY_SCREEN_SRC).toContain('getSourceIcon(entry.source)')
    expect(HISTORY_SCREEN_SRC).toContain('getSourceLabel(entry.source)')
    // Old raw source display should NOT be present
    expect(HISTORY_SCREEN_SRC).not.toContain('{entry.source} · {formatTime(entry.createdAt)}')
  })
})

// ── 4. RecipeDetailScreen source mapping ──────────────────────

describe('History Provenance — RecipeDetailScreen', () => {
  test('maps wellnessFocus origin to wellness_focus source', () => {
    expect(RECIPE_DETAIL_SRC).toContain("origin === 'wellnessFocus' ? 'wellness_focus' : 'browse_ideas'")
  })

  test('does not pass generic source: recipe', () => {
    expect(RECIPE_DETAIL_SRC).not.toContain("source: 'recipe'")
  })
})

// ── 5. WellnessResultsScreen origin ───────────────────────────

describe('History Provenance — WellnessResultsScreen', () => {
  test('passes origin: wellnessFocus to RecipeDetail', () => {
    expect(WELLNESS_RESULTS_SRC).toContain("origin: 'wellnessFocus'")
  })
})

// ── 6. TodayScreen spotlight source ───────────────────────────

describe('History Provenance — TodayScreen spotlight', () => {
  test('spotlight uses today_spotlight source (not spotlight)', () => {
    expect(TODAY_SCREEN_SRC).toContain("source: 'today_spotlight'")
    expect(TODAY_SCREEN_SRC).not.toContain("source: 'spotlight'")
  })

  test('has handleUseFocusCombo for Today\'s Focus combos', () => {
    expect(TODAY_SCREEN_SRC).toContain('handleUseFocusCombo')
    expect(TODAY_SCREEN_SRC).toContain("source: 'todays_focus'")
  })

  test('passes onUseCombo to FocusNutrientCard', () => {
    expect(TODAY_SCREEN_SRC).toContain('onUseCombo={handleUseFocusCombo}')
  })
})

// ── 7. FocusNutrientCard tappable combos ──────────────────────

describe('History Provenance — FocusNutrientCard combos', () => {
  test('imports comboToProduceIds and isComboLaunchable', () => {
    expect(FOCUS_NUTRIENT_CARD_SRC).toContain('comboToProduceIds')
    expect(FOCUS_NUTRIENT_CARD_SRC).toContain('isComboLaunchable')
  })

  test('accepts onUseCombo prop', () => {
    expect(FOCUS_NUTRIENT_CARD_SRC).toContain('onUseCombo')
  })

  test('launchable combos are Pressable with onUseCombo call', () => {
    expect(FOCUS_NUTRIENT_CARD_SRC).toContain('comboItemLaunchable')
    expect(FOCUS_NUTRIENT_CARD_SRC).toContain('onUseCombo(produceIds)')
  })

  test('non-launchable combos show explanation (not silently omitted)', () => {
    expect(FOCUS_NUTRIENT_CARD_SRC).toContain('comboItemDisabled')
    expect(FOCUS_NUTRIENT_CARD_SRC).toContain("aren't available in the builder yet")
  })

  test('combo tap does NOT call onScan (no Snap consumed)', () => {
    // The combo tap should call onUseCombo, not onScan
    const comboSection = FOCUS_NUTRIENT_CARD_SRC.match(/launchable && onUseCombo[\s\S]*?onUseCombo\(produceIds\)/)
    expect(comboSection).toBeTruthy()
    expect(comboSection[0]).not.toContain('onScan()')
  })
})

// ── 8. Source contract: manual ≠ Juice Snap ───────────────────

describe('History Provenance — source contract invariants', () => {
  test('manual log source is "manual" (never juice_snap)', () => {
    expect(HOME_SCREEN_SRC).toContain("checkin: 'manual'")
    expect(HOME_SCREEN_SRC).toContain("if (manualEntry) return 'manual'")
  })

  test('juice_snap requires camera usage', () => {
    expect(HOME_SCREEN_SRC).toContain('if (cameraUsed) return \'juice_snap\'')
  })

  test('legacy photo is NOT relabeled as juice_snap', () => {
    // In HistoryScreen, photo maps to Droplets (neutral), NOT Camera
    expect(HISTORY_SCREEN_SRC).toContain('photo: Droplets')
    expect(HISTORY_SCREEN_SRC).not.toContain('photo: Camera')
  })

  test('unknown source gets neutral fallback (never Camera)', () => {
    expect(HISTORY_SCREEN_SRC).toContain('NEUTRAL_ICON = Droplets')
    expect(HISTORY_SCREEN_SRC).toContain("NEUTRAL_LABEL = 'Juice Entry'")
  })

  test('make_again source preserved from history_make_again route', () => {
    expect(HOME_SCREEN_SRC).toContain("history_make_again: 'make_again'")
  })
})
