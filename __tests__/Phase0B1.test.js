const React = require('react')
const TestRenderer = require('react-test-renderer')
const { act } = TestRenderer

// ── Configurable mock state ──────────────────────────────────
let mockOnboardingComplete = true
let mockTotalLogCount = 5
let mockTodayJuices = [{ ingredients: [{ name: 'Apple' }, { name: 'Carrot' }] }]
let mockVitalityScore = 72

// Mock navigation
const mockNavigate = jest.fn()
const mockAddListener = jest.fn().mockReturnValue(jest.fn())
const mockNavigation = { navigate: mockNavigate, addListener: mockAddListener, removeListener: jest.fn() }

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiRemove: jest.fn().mockResolvedValue(undefined),
}))

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
}))

// Mock expo-linear-gradient — jest-expo handles the native module, but we need the JS component
jest.mock('expo-linear-gradient', () => {
  const React = require('react')
  const LinearGradient = (props) => React.createElement(React.Fragment, null, props.children)
  return { LinearGradient }
})

// Mock ALL src/components — individual components tested separately
jest.mock('../src/components/MeshGradientBg', () => {
  const React = require('react')
  return { __esModule: true, default: () => React.createElement(React.Fragment) }
})
jest.mock('../src/components/NutrientHaloCard', () => {
  const React = require('react')
  return { __esModule: true, default: () => React.createElement(React.Fragment) }
})
jest.mock('../src/components/WeeklyPillarView', () => {
  const React = require('react')
  return { __esModule: true, default: () => React.createElement(React.Fragment) }
})
jest.mock('../src/components/QuickLogger', () => {
  const React = require('react')
  return { __esModule: true, default: () => React.createElement(React.Fragment) }
})
jest.mock('../src/components/RewardSplash', () => {
  const React = require('react')
  return { __esModule: true, default: () => React.createElement(React.Fragment) }
})
jest.mock('../src/components/AchievementOverlay', () => {
  const React = require('react')
  return { __esModule: true, default: () => React.createElement(React.Fragment) }
})
jest.mock('../src/components/TodaysJuiceSpotlight', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: () => React.createElement(React.Fragment),
    JuiceSpotlightDetailsModal: () => React.createElement(React.Fragment),
  }
})
jest.mock('../src/components/LiquidNutrientOrb', () => {
  const React = require('react')
  return { __esModule: true, default: () => React.createElement(React.Fragment) }
})
jest.mock('../src/components/FocusNutrientCard', () => {
  const React = require('react')
  return { __esModule: true, default: () => React.createElement(React.Fragment) }
})
jest.mock('../src/components/TodaySummaryStats', () => {
  const React = require('react')
  return { __esModule: true, default: () => React.createElement(React.Fragment) }
})
jest.mock('../src/components/WeeklySummaryTeaser', () => {
  const React = require('react')
  return { __esModule: true, default: () => React.createElement(React.Fragment) }
})

// Mock lucide-react-native — explicit named exports as no-op components
jest.mock('lucide-react-native', () => {
  const noop = () => null
  return new Proxy({}, { get: () => noop })
})

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react')
  return {
    SafeAreaView: (props) => React.createElement(React.Fragment, null, props.children),
    SafeAreaProvider: (props) => React.createElement(React.Fragment, null, props.children),
    SafeAreaConsumer: (props) => React.createElement(React.Fragment, null, props.children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  }
})

jest.mock('../src/services/glowStreak', () => ({
  useGlowStreak: () => ({ count: 3, lastCheckInDate: '2025-01-15' }),
  getGlowTodayKey: () => '2025-01-15',
  getGlowState: jest.fn().mockResolvedValue({ count: 3 }),
  checkInToday: jest.fn(),
  skipToday: jest.fn(),
}))

jest.mock('../src/services/ActivationStore', () => ({
  useActivation: () => ({
    activation: { onboardingComplete: mockOnboardingComplete },
    unlocks: { totalLogsCount: mockTotalLogCount, nutrientHalo: true, weeklyPillar: false },
    recordLog: jest.fn(),
    recordOnboardingComplete: jest.fn(),
    recordTrackingOptIn: jest.fn(),
    setGoal: jest.fn(),
    recordIntroDismissed: jest.fn(),
  }),
}))

jest.mock('../src/services/FeatureFlags', () => ({
  useFlags: () => ({ isEnabled: (flag) => {
    if (flag === 'ff_nutrient_halo_progress') return true
    if (flag === 'ff_weekly_pillar_view') return false
    if (flag === 'ff_3step_logger') return false
    if (flag === 'ff_reward_splash') return false
    if (flag === 'ff_expanded_recipes') return true
    if (flag === 'ff_scan_secondary_actions') return true
    return false
  }}),
}))

jest.mock('../src/services/JuiceLogStore', () => ({
  useJuiceLog: () => ({
    todayEntries: [{ nutrientSummary: { vitaminC: 50, potassium: 300 } }],
    totalLogCount: mockTotalLogCount,
    diversityStats: { uniqueProduce: 8 },
  }),
}))

jest.mock('../src/services/NutritionScoreStore', () => ({
  useNutritionScore: () => ({ momentum: 72, streak: { currentCycleStreak: 3 } }),
}))

jest.mock('../src/services/UserProfileStore', () => ({
  useUserProfile: () => ({ profile: { name: 'Test' } }),
}))

jest.mock('../src/services/ChallengeStore', () => ({
  useChallenge: () => ({
    challenge: { currentDay: 3, days: [] },
    logJuice: jest.fn(),
    todayLog: { juices: mockTodayJuices },
    vitalityScore: mockVitalityScore,
  }),
  DAILY_PILLARS: {
    vitaminC: { color: '#FFB74D', shortLabel: 'Vit C' },
    potassium: { color: '#64B5F6', shortLabel: 'K' },
  },
}))

jest.mock('../src/services/AnalyticsService', () => ({
  trackEvent: jest.fn(),
}))

jest.mock('../src/services/achievements', () => ({
  checkAchievements: jest.fn().mockResolvedValue([]),
}))

jest.mock('../src/data/juiceSpotlights', () => ({
  getSpotlightForDay: () => ({
    id: 'test-spotlight',
    name: 'Test Blend',
    ingredientLabels: ['Apple', 'Carrot'],
    ingredients: [{ name: 'Apple' }, { name: 'Carrot' }],
    shortDescription: 'A test blend',
    preparationSteps: ['Step 1', 'Step 2'],
    juicerNote: 'Test note',
  }),
  getSpotlightState: () => ({ kind: 'new' }),
}))

jest.mock('../src/services/focusNutrient', () => ({
  getFocusForToday: jest.fn().mockResolvedValue({
    id: 'vitaminC',
    name: 'Vitamin C',
    emoji: '🍊',
    benefit: 'Immunity support',
    combos: ['Orange + Kale'],
    tips: ['Tip 1'],
  }),
  swapFocusToday: jest.fn().mockResolvedValue({ swapped: true, nutrient: { id: 'vitaminA', name: 'Vitamin A' } }),
}))

jest.mock('../src/services/weeklySummary', () => ({
  shouldShowWeeklySummary: jest.fn().mockResolvedValue({ show: false }),
  dismissWeeklySummary: jest.fn(),
  buildWeeklySummaryData: jest.fn().mockReturnValue({
    juicesThisWeek: 3,
    glowStreak: 3,
    highlightNutrient: 'Vitamin C',
  }),
}))

// ── Helpers ───────────────────────────────────────────────────

function findAllByText(instance, text) {
  const matches = []
  function walk(node) {
    if (!node) return
    if (typeof node === 'string') {
      if (node === text) matches.push(node)
      return
    }
    if (typeof node === 'number') {
      if (String(node) === String(text)) matches.push(node)
      return
    }
    if (node.props && node.props.children !== undefined) {
      if (Array.isArray(node.props.children)) {
        node.props.children.forEach(walk)
      } else {
        walk(node.props.children)
      }
    }
    if (node.children) {
      node.children.forEach(walk)
    }
  }
  walk(instance)
  return matches
}

// Pre-load real FocusNutrientCard at module level so module loading
// does not count against per-test wall-clock timeout under parallel execution
const RealFocusNutrientCard = jest.requireActual('../src/components/FocusNutrientCard').default

const rendererRegistry = []

function renderTree(component) {
  let renderer
  act(() => {
    renderer = TestRenderer.create(component)
  })
  rendererRegistry.push(renderer)
  return renderer.root
}

// ── Test Suite ───────────────────────────────────────────────

describe('Phase 0B1 — Today/Explore Refactoring', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockOnboardingComplete = true
    mockTotalLogCount = 5
    mockTodayJuices = [{ ingredients: [{ name: 'Apple' }, { name: 'Carrot' }] }]
    mockVitalityScore = 72
  })

  afterEach(() => {
    act(() => {
      while (rendererRegistry.length > 0) {
        const renderer = rendererRegistry.pop()
        if (renderer && typeof renderer.unmount === 'function') {
          renderer.unmount()
        }
      }
    })
    jest.useRealTimers()
  })

  // ── 1. FocusNutrientCard renders ──
  // Per-test timeout: under default parallel Jest (12 workers on 24-core machine),
  // CPU contention from heavy suites (e.g. Phase0C3 at 15s) can cause the 5s default
  // wall-clock timeout to be exceeded for tests rendering real React components
  // with async effects. The async work itself is immediate (mocked getFocusForToday),
  // but React reconciler + effect flushing under contention needs headroom.
  test('FocusNutrientCard renders without crashing (returns null until async loads)', async () => {
    let renderer
    act(() => {
      renderer = TestRenderer.create(React.createElement(RealFocusNutrientCard, { onScan: jest.fn(), isReduced: false }))
    })
    rendererRegistry.push(renderer)
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve))
    })
    expect(renderer.root).toBeTruthy()
  }, 10000)

  // ── 2. FocusNutrientCard shows swap button after async load ──
  test('FocusNutrientCard shows Swap button after focus nutrient loads', async () => {
    let renderer
    act(() => {
      renderer = TestRenderer.create(React.createElement(RealFocusNutrientCard, { onScan: jest.fn(), isReduced: false }))
    })
    rendererRegistry.push(renderer)
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve))
    })
    const swaps = findAllByText(renderer.root, 'Swap')
    expect(swaps.length).toBeGreaterThan(0)
  }, 10000)

  // ── 3. TodaySummaryStats renders with correct values ──
  test('TodaySummaryStats renders today count, score, and streak', () => {
    const TodaySummaryStats = jest.requireActual('../src/components/TodaySummaryStats').default
    const instance = renderTree(
      React.createElement(TodaySummaryStats, { todayCount: 2, todayScore: 72, streakCount: 3, suggestion: 'Great coverage!' })
    )
    expect(findAllByText(instance, 2).length).toBeGreaterThan(0)
    expect(findAllByText(instance, 72).length).toBeGreaterThan(0)
    expect(findAllByText(instance, 'juices').length).toBeGreaterThan(0)
    expect(findAllByText(instance, 'score').length).toBeGreaterThan(0)
    expect(findAllByText(instance, 'streak').length).toBeGreaterThan(0)
    expect(findAllByText(instance, 'Great coverage!').length).toBeGreaterThan(0)
  })

  // ── 4. TodaySummaryStats shows suggestion text ──
  test('TodaySummaryStats displays dynamic suggestion', () => {
    const TodaySummaryStats = jest.requireActual('../src/components/TodaySummaryStats').default
    const instance = renderTree(
      React.createElement(TodaySummaryStats, { todayCount: 0, todayScore: 0, streakCount: 5, suggestion: 'Keep your 5-day streak alive!' })
    )
    expect(findAllByText(instance, 'Keep your 5-day streak alive!').length).toBeGreaterThan(0)
  })

  // ── 5. WeeklySummaryTeaser does not render when shouldShowWeeklySummary is false ──
  test('WeeklySummaryTeaser renders null when shouldShowWeeklySummary returns false', () => {
    const WeeklySummaryTeaser = jest.requireActual('../src/components/WeeklySummaryTeaser').default
    let renderer
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(WeeklySummaryTeaser, { juicesThisWeek: 3, glowStreakCount: 3, isReduced: false })
      )
    })
    rendererRegistry.push(renderer)
    expect(renderer.toJSON()).toBeNull()
  })

  // ── 6. TodayScreen renders without crash ──
  test('TodayScreen renders without crashing', () => {
    const TodayScreen = require('../src/screens/TodayScreen').default
    const instance = renderTree(React.createElement(TodayScreen, { navigation: mockNavigation }))
    expect(instance).toBeTruthy()
  })

  // ── 7. TodayScreen shows header "Today" ──
  test('TodayScreen shows Today header', () => {
    const TodayScreen = require('../src/screens/TodayScreen').default
    const instance = renderTree(React.createElement(TodayScreen, { navigation: mockNavigation }))
    expect(findAllByText(instance, 'Today').length).toBeGreaterThan(0)
  })

  // ── 8. TodayScreen post-log state shows hero card ──
  test('TodayScreen post-log shows Today Hero with produce list', () => {
    const TodayScreen = require('../src/screens/TodayScreen').default
    const instance = renderTree(React.createElement(TodayScreen, { navigation: mockNavigation }))
    expect(findAllByText(instance, "Today's Juice").length).toBeGreaterThan(0)
  })

  // ── 9. TodayScreen pre-log shows scan prompt (when no juices logged) ──
  test('TodayScreen pre-log shows scan prompt when no juices', () => {
    mockTodayJuices = []
    mockVitalityScore = 0
    const TodayScreen = require('../src/screens/TodayScreen').default
    const instance = renderTree(React.createElement(TodayScreen, { navigation: mockNavigation }))
    expect(findAllByText(instance, "Ready for today's juice?").length).toBeGreaterThan(0)
  })

  // ── 10. ScanScreen renders without crash ──
  test('ScanScreen renders without crashing', () => {
    const ScanScreen = require('../src/screens/ScanScreen').default
    const instance = renderTree(React.createElement(ScanScreen, { navigation: mockNavigation }))
    expect(instance).toBeTruthy()
  })

  // ── 11. ScanScreen BrowseHome shows discovery headline ──
  test('ScanScreen shows discovery headline in browse mode', () => {
    mockOnboardingComplete = false
    mockTotalLogCount = 0
    const ScanScreen = require('../src/screens/ScanScreen').default
    const instance = renderTree(React.createElement(ScanScreen, { navigation: mockNavigation }))
    expect(findAllByText(instance, 'What will you juice today?').length).toBeGreaterThan(0)
  })

  // ── 12. ScanScreen BrowseHome does not show Glow Streak card ──
  test('ScanScreen BrowseHome has no Glow Streak card', () => {
    mockOnboardingComplete = false
    mockTotalLogCount = 0
    const ScanScreen = require('../src/screens/ScanScreen').default
    const instance = renderTree(React.createElement(ScanScreen, { navigation: mockNavigation }))
    expect(findAllByText(instance, 'Glow Streak').length).toBe(0)
  })

  // ── 13. ScanScreen BrowseHome does not show View Today CTA ──
  test('ScanScreen BrowseHome has no View Today CTA', () => {
    mockOnboardingComplete = false
    mockTotalLogCount = 5
    const ScanScreen = require('../src/screens/ScanScreen').default
    const instance = renderTree(React.createElement(ScanScreen, { navigation: mockNavigation }))
    expect(findAllByText(instance, 'View Today').length).toBe(0)
  })

  // ── 14. ScanScreen BrowseHome shows discovery action cards ──
  test('ScanScreen BrowseHome shows Browse Juice Ideas action', () => {
    mockOnboardingComplete = false
    mockTotalLogCount = 0
    const ScanScreen = require('../src/screens/ScanScreen').default
    const instance = renderTree(React.createElement(ScanScreen, { navigation: mockNavigation }))
    expect(findAllByText(instance, 'Browse Juice Ideas').length).toBeGreaterThan(0)
    expect(findAllByText(instance, 'Learn How It Works').length).toBeGreaterThan(0)
    expect(findAllByText(instance, 'Try a Demo Scan').length).toBeGreaterThan(0)
  })

  // ── 15. ScanScreen BrowseHome shows scan CTA for new users ──
  test('ScanScreen BrowseHome shows Reveal My Nutrients CTA for new users', () => {
    mockOnboardingComplete = false
    mockTotalLogCount = 0
    const ScanScreen = require('../src/screens/ScanScreen').default
    const instance = renderTree(React.createElement(ScanScreen, { navigation: mockNavigation }))
    expect(findAllByText(instance, 'Reveal My Nutrients').length).toBeGreaterThan(0)
  })

  // ── 16. ScanScreen BrowseHome shows Scan Produce for returning users ──
  test('ScanScreen BrowseHome shows Scan Produce CTA for returning users', () => {
    mockOnboardingComplete = false
    mockTotalLogCount = 5
    const ScanScreen = require('../src/screens/ScanScreen').default
    const instance = renderTree(React.createElement(ScanScreen, { navigation: mockNavigation }))
    expect(findAllByText(instance, 'Scan Produce').length).toBeGreaterThan(0)
  })

  // ── 17. ScanScreen does not import dashboard modules ──
  test('ScanScreen no longer imports TodaysJuiceSpotlight or AchievementOverlay', () => {
    const fs = require('fs')
    const path = require('path')
    const content = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/ScanScreen.js'),
      'utf8'
    )
    expect(content).not.toContain('TodaysJuiceSpotlight')
    expect(content).not.toContain('AchievementOverlay')
    expect(content).not.toContain('getGlowState')
    expect(content).not.toContain('getFocusForToday')
    expect(content).not.toContain('shouldShowWeeklySummary')
    expect(content).not.toContain('checkAchievements')
  })

  // ── 18. ScanScreen timer cleanup on unmount ──
  test('ScanScreen clears NutrientTeaser interval on unmount and prevents Animated.timing after unmount', () => {
    jest.useFakeTimers()
    const { Animated } = require('react-native')
    const timingSpy = jest.spyOn(Animated, 'timing')
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

    const ScanScreen = require('../src/screens/ScanScreen').default
    let renderer
    act(() => {
      renderer = TestRenderer.create(React.createElement(ScanScreen, { navigation: mockNavigation }))
    })
    rendererRegistry.push(renderer)

    const intervalId = renderer.root
      .findAllByType(require('react-native').View)
      .reduce((acc, node) => acc, null)

    act(() => {
      renderer.unmount()
    })

    expect(clearIntervalSpy).toHaveBeenCalled()

    timingSpy.mockClear()
    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(timingSpy).not.toHaveBeenCalled()

    timingSpy.mockRestore()
    clearIntervalSpy.mockRestore()
    jest.useRealTimers()
  })
})
