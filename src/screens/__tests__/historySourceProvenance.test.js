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
    expect(HOME_SCREEN_SRC).toContain("recipe: 'manual'")
    expect(HOME_SCREEN_SRC).toContain("today_spotlight: 'today_spotlight'")
    expect(HOME_SCREEN_SRC).toContain("todays_focus: 'todays_focus'")
    expect(HOME_SCREEN_SRC).toContain("history_make_again: 'make_again'")
    expect(HOME_SCREEN_SRC).toContain("checkin: 'manual'")
    // New recipe-source provenance types
    expect(HOME_SCREEN_SRC).toContain("browse_ideas: 'browse_ideas'")
    expect(HOME_SCREEN_SRC).toContain("wellness_focus: 'wellness_focus'")
    expect(HOME_SCREEN_SRC).toContain("simple_blend: 'simple_blend'")
    expect(HOME_SCREEN_SRC).toContain("seasonal_glow: 'seasonal_glow'")
    expect(HOME_SCREEN_SRC).toContain("produce_recipe: 'produce_recipe'")
    expect(HOME_SCREEN_SRC).toContain("glow_library: 'glow_library'")
    expect(HOME_SCREEN_SRC).toContain("beginner_glow: 'beginner_glow'")
  })

  test('camera route source is NOT mapped to juice_snap (Juice Snap requires actual camera use)', () => {
    // The 'camera' key was removed from ROUTE_SOURCE_TO_LOG_SOURCE.
    // Juice Snap must be proven by cameraUsedRef.current === true,
    // not inferred from the route name or default source.
    expect(HOME_SCREEN_SRC).not.toContain("camera: 'juice_snap'")
  })

  test('default route source is manual (not camera)', () => {
    // The default source when no route param is specified must be
    // 'manual', not 'camera'. This prevents fresh manual entries
    // from being falsely labeled as Juice Snap.
    expect(HOME_SCREEN_SRC).toContain("route?.params?.source || 'manual'")
    expect(HOME_SCREEN_SRC).not.toContain("route?.params?.source || 'camera'")
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

  test('cameraUsedRef reset when user switches to manual entry from camera', () => {
    // The onManualEntry callback must reset cameraUsedRef so that
    // a prior camera scan doesn't contaminate a subsequent manual entry.
    const manualEntrySection = HOME_SCREEN_SRC.match(/onManualEntry=\{\(\) => \{[\s\S]*?\}\}/)
    expect(manualEntrySection).toBeTruthy()
    expect(manualEntrySection[0]).toContain('cameraUsedRef.current = false')
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
    expect(HISTORY_SCREEN_SRC).toContain('simple_blend: Sparkle')
    expect(HISTORY_SCREEN_SRC).toContain('seasonal_glow: Sun')
    expect(HISTORY_SCREEN_SRC).toContain('produce_recipe: Leaf')
    expect(HISTORY_SCREEN_SRC).toContain('glow_library: Trophy')
    expect(HISTORY_SCREEN_SRC).toContain('beginner_glow: Beaker')
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
    expect(HISTORY_SCREEN_SRC).toContain("simple_blend: 'Simple Blend'")
    expect(HISTORY_SCREEN_SRC).toContain("seasonal_glow: 'Seasonal Glow Pack'")
    expect(HISTORY_SCREEN_SRC).toContain("produce_recipe: 'Produce Recipe'")
    expect(HISTORY_SCREEN_SRC).toContain("glow_library: 'Glow Library'")
    expect(HISTORY_SCREEN_SRC).toContain("beginner_glow: 'Beginner Glow Path'")
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

  test('supports openEntryId route param for external navigation', () => {
    // HistoryScreen must accept an openEntryId route param to open
    // a specific entry's details modal (used by Today's "View Today's Juice")
    expect(HISTORY_SCREEN_SRC).toContain('useRoute')
    expect(HISTORY_SCREEN_SRC).toContain('openEntryId')
    expect(HISTORY_SCREEN_SRC).toContain('setSelectedEntry')
  })
})

// ── 4. RecipeDetailScreen source mapping ──────────────────────

describe('History Provenance — RecipeDetailScreen', () => {
  test('has RECIPE_ORIGIN_TO_SOURCE mapping object', () => {
    expect(RECIPE_DETAIL_SRC).toContain('RECIPE_ORIGIN_TO_SOURCE')
  })

  test('maps browseIdeas origin to browse_ideas source', () => {
    expect(RECIPE_DETAIL_SRC).toContain("browseIdeas: 'browse_ideas'")
  })

  test('maps wellnessFocus origin to wellness_focus source', () => {
    expect(RECIPE_DETAIL_SRC).toContain("wellnessFocus: 'wellness_focus'")
  })

  test('maps simpleBlend origin to simple_blend source', () => {
    expect(RECIPE_DETAIL_SRC).toContain("simpleBlend: 'simple_blend'")
  })

  test('maps seasonalGlow origin to seasonal_glow source', () => {
    expect(RECIPE_DETAIL_SRC).toContain("seasonalGlow: 'seasonal_glow'")
  })

  test('maps produceRecipe origin to produce_recipe source', () => {
    expect(RECIPE_DETAIL_SRC).toContain("produceRecipe: 'produce_recipe'")
  })

  test('maps glowLibrary origin to glow_library source', () => {
    expect(RECIPE_DETAIL_SRC).toContain("glowLibrary: 'glow_library'")
  })

  test('maps beginnerGlow origin to beginner_glow source', () => {
    expect(RECIPE_DETAIL_SRC).toContain("beginnerGlow: 'beginner_glow'")
  })

  test('unknown origin falls back to recipe source', () => {
    expect(RECIPE_DETAIL_SRC).toContain("RECIPE_ORIGIN_TO_SOURCE[origin] || 'recipe'")
  })

  test('passes manualEntry: true (correct UX for recipe launches)', () => {
    expect(RECIPE_DETAIL_SRC).toContain('manualEntry: true')
  })

  test('HomeScreen maps recipe source to manual (fallback for unknown origins)', () => {
    expect(HOME_SCREEN_SRC).toContain("recipe: 'manual'")
  })
})

// ── 4b. RecipeDetail non-browse origins audit ─────────────────

describe('History Provenance — non-browse RecipeDetail origins', () => {
  // These screens now pass specific origins to RecipeDetail:
  // - TodayScreen (Simple Blend) → origin: 'simpleBlend'
  // - SeasonalGlowPacksScreen → origin: 'seasonalGlow'
  // - ProduceRecipeResultsScreen → origin: 'produceRecipe'
  // - GlowLibraryScreen → origin: 'glowLibrary'
  // - BeginnerGlowPathScreen → origin: 'beginnerGlow'
  // Each gets its own provenance source — NOT falsely labeled browse_ideas.

  test('RecipeDetailScreen maps all 7 origins to specific sources', () => {
    // The mapping should use a lookup object, not a binary default
    expect(RECIPE_DETAIL_SRC).toContain('RECIPE_ORIGIN_TO_SOURCE')
    // All 7 origins should be in the mapping
    expect(RECIPE_DETAIL_SRC).toContain('browseIdeas')
    expect(RECIPE_DETAIL_SRC).toContain('wellnessFocus')
    expect(RECIPE_DETAIL_SRC).toContain('simpleBlend')
    expect(RECIPE_DETAIL_SRC).toContain('seasonalGlow')
    expect(RECIPE_DETAIL_SRC).toContain('produceRecipe')
    expect(RECIPE_DETAIL_SRC).toContain('glowLibrary')
    expect(RECIPE_DETAIL_SRC).toContain('beginnerGlow')
  })

  test('RecipeDetailScreen does NOT default non-wellness to browse_ideas', () => {
    expect(RECIPE_DETAIL_SRC).not.toMatch(/'wellness_focus'\s*:\s*'browse_ideas'/)
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

  test('HomeScreen maps today_spotlight route source correctly', () => {
    // The ROUTE_SOURCE_TO_LOG_SOURCE map must have 'today_spotlight'
    // as a key (not 'spotlight') to match what TodayScreen passes.
    expect(HOME_SCREEN_SRC).toContain("today_spotlight: 'today_spotlight'")
    // The old 'spotlight' key must NOT be present
    expect(HOME_SCREEN_SRC).not.toMatch(/['"]spotlight['"]\s*:\s*['"]today_spotlight['"]/)
  })

  test('View Today\'s Juice button is not a no-op', () => {
    // The onViewToday handler must NOT be an empty arrow function
    expect(TODAY_SCREEN_SRC).not.toContain('onViewToday={() => {}}')
    // It should use a handler that navigates to History
    expect(TODAY_SCREEN_SRC).toContain('handleViewTodayJuice')
    expect(TODAY_SCREEN_SRC).toContain('HistoryTab')
    expect(TODAY_SCREEN_SRC).toContain('openEntryId')
  })

  test('handleViewTodayJuice uses latest today entry id', () => {
    expect(TODAY_SCREEN_SRC).toContain('todayEntries[0]')
    expect(TODAY_SCREEN_SRC).toContain('latestEntry.id')
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

// ── 9. Fridge Forager removal verification ───────────────────

describe('Fridge Forager removal', () => {
  const APP_SRC = readSrc('../../../App.js')

  test('App.js does not import FridgeForagerScreen', () => {
    expect(APP_SRC).not.toContain('FridgeForagerScreen')
  })

  test('App.js does not register FridgeForager route', () => {
    expect(APP_SRC).not.toContain('"FridgeForager"')
    expect(APP_SRC).not.toContain("'FridgeForager'")
  })

  test('FridgeForagerScreen.js file no longer exists', () => {
    const screenPath = path.join(__dirname, '../FridgeForagerScreen.js')
    expect(fs.existsSync(screenPath)).toBe(false)
  })

  test('fridgeForagerVirtualization test file no longer exists', () => {
    const testPath = path.join(__dirname, 'fridgeForagerVirtualization.test.js')
    expect(fs.existsSync(testPath)).toBe(false)
  })

  test('TodayScreen does not navigate to FridgeForager', () => {
    expect(TODAY_SCREEN_SRC).not.toContain("navigate('FridgeForager')")
  })

  test('DashboardScreen does not navigate to FridgeForager', () => {
    const dashSrc = readSrc('../../screens/DashboardScreen.js')
    expect(dashSrc).not.toContain("navigate('FridgeForager'")
  })

  test('WeeklyReportScreen does not navigate to FridgeForager', () => {
    const weeklySrc = readSrc('../../screens/WeeklyReportScreen.js')
    expect(weeklySrc).not.toContain("navigate('FridgeForager'")
  })

  test('ProStore does not list fridgeForager feature', () => {
    const proSrc = readSrc('../../services/ProStore.js')
    expect(proSrc).not.toContain('fridgeForager')
  })

  test('SnapGateModal does not mention Fridge Forager', () => {
    const snapSrc = readSrc('../../components/SnapGateModal.js')
    expect(snapSrc).not.toContain('Fridge Forager')
  })

  test('NotificationLibrary does not reference open_fridge_forager', () => {
    const notifSrc = readSrc('../../constants/NotificationLibrary.js')
    expect(notifSrc).not.toContain('open_fridge_forager')
  })

  test('OptimizeScreen does not route to FridgeForager', () => {
    const optSrc = readSrc('../../screens/OptimizeScreen.js')
    expect(optSrc).not.toContain("route: 'FridgeForager'")
  })

  test('HistoryScreen does not have a fridge_forager source type', () => {
    expect(HISTORY_SCREEN_SRC).not.toContain('fridge_forager')
    expect(HISTORY_SCREEN_SRC).not.toContain('Fridge Forager')
  })
})
