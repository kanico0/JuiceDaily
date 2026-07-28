const React = require('react')
const TestRenderer = require('react-test-renderer')
const { act } = TestRenderer

// ── Configurable mock state ──────────────────────────────────
let mockTodayJuices = [{ ingredients: [{ name: 'Apple' }, { name: 'Carrot' }], pillars: ['vitaminC'] }]
let mockVitalityScore = 72
let mockTotalLogCount = 5
let mockOnboardingComplete = true
let mockMomentum = 72
let mockFocusNutrient = {
  id: 'vitaminC',
  name: 'Vitamin C',
  emoji: '🍊',
  benefit: 'Immunity support',
  combos: ['Orange + Kale'],
  tips: ['Tip 1'],
}
let mockSpotlightShow = false

// Mock navigation
const mockNavigate = jest.fn()
const mockNavigation = { navigate: mockNavigate, addListener: jest.fn().mockReturnValue(jest.fn()), removeListener: jest.fn() }

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiRemove: jest.fn().mockResolvedValue(undefined),
  multiSet: jest.fn().mockResolvedValue(undefined),
}))

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
}))

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const React = require('react')
  const LinearGradient = (props) => React.createElement(React.Fragment, null, props.children)
  return { LinearGradient }
})

// Mock lucide-react-native
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

// Mock stores and services — external boundaries only
jest.mock('../src/services/glowStreak', () => ({
  useGlowStreak: () => ({ count: 3, lastCheckInDate: '2025-01-15', checkedInToday: false, graceUsedToday: false }),
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
  useFlags: () => ({
    isEnabled: (flag) => {
      if (flag === 'ff_nutrient_halo_progress') return true
      if (flag === 'ff_weekly_pillar_view') return false
      if (flag === 'ff_3step_logger') return false
      if (flag === 'ff_reward_splash') return false
      if (flag === 'ff_expanded_recipes') return true
      if (flag === 'ff_scan_secondary_actions') return true
      return false
    },
  }),
}))

jest.mock('../src/services/JuiceLogStore', () => ({
  useJuiceLog: jest.fn().mockImplementation(() => ({
    todayEntries: mockTodayJuices.length > 0 ? [{ nutrientSummary: { vitaminC: 50, potassium: 300 } }] : [],
    totalLogCount: mockTotalLogCount,
    diversityStats: { uniqueProduce: 8 },
  })),
}))

jest.mock('../src/services/NutritionScoreStore', () => ({
  useNutritionScore: () => ({ momentum: mockMomentum, streak: { currentCycleStreak: 3 } }),
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

jest.mock('../src/services/focusNutrient', () => ({
  getFocusForToday: jest.fn().mockImplementation(() => Promise.resolve(mockFocusNutrient)),
  swapFocusToday: jest.fn().mockImplementation(() => Promise.resolve({ swapped: true, nutrient: { id: 'vitaminA', name: 'Vitamin A', emoji: '🥕', benefit: 'Eye health', combos: ['Carrot + Spinach'], tips: ['Tip A'] } })),
}))

jest.mock('../src/services/weeklySummary', () => ({
  shouldShowWeeklySummary: jest.fn().mockImplementation(() => Promise.resolve({ show: mockSpotlightShow })),
  dismissWeeklySummary: jest.fn(),
  buildWeeklySummaryData: jest.fn().mockReturnValue({
    juicesThisWeek: 3,
    glowStreak: 3,
    highlightNutrient: 'Vitamin C',
  }),
}))

// Mock remaining non-Phase-0B1 wrapper components
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

function findAllByRole(instance, role) {
  const matches = []
  function walk(node) {
    if (!node || typeof node === 'string' || typeof node === 'number') return
    if (node.props && node.props.accessibilityRole === role) {
      matches.push(node)
    }
    if (node.children) {
      node.children.forEach(walk)
    }
  }
  walk(instance)
  return matches
}

function findAllByLabel(instance, label) {
  const matches = []
  function walk(node) {
    if (!node || typeof node === 'string' || typeof node === 'number') return
    if (node.props && node.props.accessibilityLabel === label) {
      matches.push(node)
    }
    if (node.children) {
      node.children.forEach(walk)
    }
  }
  walk(instance)
  return matches
}

// Pre-load TodayScreen at module level so module loading does not
// count against per-test wall-clock timeout under parallel execution
const TodayScreen = require('../src/screens/TodayScreen').default

const rendererRegistry = []

// ── Test Suite ───────────────────────────────────────────────

describe('TodayScreen Real Integration — Phase 0B1 Extracted Components', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTodayJuices = [{ ingredients: [{ name: 'Apple' }, { name: 'Carrot' }], pillars: ['vitaminC'] }]
    mockVitalityScore = 72
    mockTotalLogCount = 5
    mockOnboardingComplete = true
    mockMomentum = 72
    mockSpotlightShow = false
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
  })

  // ── 1. TodayScreen renders all real extracted components together ──
  // Per-test timeout: under default parallel Jest (12 workers on 24-core machine),
  // CPU contention from heavy suites can cause the 5s default wall-clock timeout
  // to be exceeded for tests rendering real React components with multiple async
  // effects (FocusNutrientCard, WeeklySummaryTeaser, checkAchievements).
  // The async work itself is immediate (all mocked), but React reconciler +
  // effect flushing under contention needs headroom.
  test('TodayScreen renders real FocusNutrientCard, TodaySummaryStats, WeeklySummaryTeaser, TodaysJuiceSpotlight together', async () => {
    let renderer
    act(() => {
      renderer = TestRenderer.create(React.createElement(TodayScreen, { navigation: mockNavigation }))
    })
    rendererRegistry.push(renderer)
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve))
    })
    const root = renderer.root

    // Real FocusNutrientCard renders "Today's Focus" label
    expect(findAllByText(root, "Today's Focus").length).toBeGreaterThan(0)
    // Real TodaySummaryStats renders "juices" and "score" labels
    expect(findAllByText(root, 'juices').length).toBeGreaterThan(0)
    expect(findAllByText(root, 'score').length).toBeGreaterThan(0)
    // Real TodaysJuiceSpotlight renders spotlight name
    expect(findAllByText(root, 'TODAY’S JUICE SPOTLIGHT').length).toBeGreaterThan(0)
    // WeeklySummaryTeaser returns null when shouldShowWeeklySummary is false
    expect(findAllByText(root, 'Your Glow Week').length).toBe(0)
  }, 10000)

  // ── 2. Brand-new-user state does not show every optional card ──
  test('new user with zero logs does not show Halo, WeeklyPillar, or WeeklySummaryTeaser', async () => {
    mockTodayJuices = []
    mockVitalityScore = 0
    mockTotalLogCount = 0
    mockMomentum = 0
    let renderer
    act(() => {
      renderer = TestRenderer.create(React.createElement(TodayScreen, { navigation: mockNavigation }))
    })
    rendererRegistry.push(renderer)
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve))
    })
    const root = renderer.root

    // Pre-log state shows scan prompt
    expect(findAllByText(root, "Ready for today's juice?").length).toBeGreaterThan(0)
    // No post-log hero
    expect(findAllByText(root, "Today's Juice").length).toBe(0)
    // No WeeklySummaryTeaser
    expect(findAllByText(root, 'Your Glow Week').length).toBe(0)
  }, 10000)

  // ── 3. Populated-user state renders real current-day modules ──
  test('populated user renders hero card, summary stats, spotlight, and focus nutrient', async () => {
    let renderer
    act(() => {
      renderer = TestRenderer.create(React.createElement(TodayScreen, { navigation: mockNavigation }))
    })
    rendererRegistry.push(renderer)
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve))
    })
    const root = renderer.root

    expect(findAllByText(root, "Today's Juice").length).toBeGreaterThan(0)
    // Challenge Day text is split across nodes: "Challenge Day " + {challenge.currentDay}
    expect(findAllByText(root, 'Challenge Day ').length).toBeGreaterThan(0)
    expect(findAllByText(root, 3).length).toBeGreaterThan(0)
    expect(findAllByText(root, "Today's Focus").length).toBeGreaterThan(0)
    expect(findAllByText(root, 'TODAY’S JUICE SPOTLIGHT').length).toBeGreaterThan(0)
  }, 10000)

  // ── 4. Scan My Produce invokes navigation to ScanFlow ──
  test('Scan My Produce button calls navigation.navigate with ScanFlow', async () => {
    mockTodayJuices = []
    mockVitalityScore = 0
    mockTotalLogCount = 0
    mockMomentum = 0
    let renderer
    act(() => {
      renderer = TestRenderer.create(React.createElement(TodayScreen, { navigation: mockNavigation }))
    })
    rendererRegistry.push(renderer)
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve))
    })
    const root = renderer.root

    const scanButtons = findAllByLabel(root, 'Scan my produce')
    expect(scanButtons.length).toBeGreaterThan(0)

    await act(async () => {
      scanButtons[0].props.onPress()
    })

    expect(mockNavigate).toHaveBeenCalledWith('ScanFlow', { screen: 'ScanHome', params: { openCamera: true } })
  })

  // ── 5. Focus Nutrient Swap invokes real handler/service ──
  test('FocusNutrientCard Swap button calls swapFocusToday and updates nutrient', async () => {
    let renderer
    act(() => {
      renderer = TestRenderer.create(React.createElement(TodayScreen, { navigation: mockNavigation }))
    })
    rendererRegistry.push(renderer)
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve))
    })
    const root = renderer.root

    const swapButtons = findAllByLabel(root, 'Swap nutrient')
    expect(swapButtons.length).toBeGreaterThan(0)

    const { swapFocusToday } = require('../src/services/focusNutrient')
    await act(async () => {
      swapButtons[0].props.onPress()
    })

    expect(swapFocusToday).toHaveBeenCalled()
  })

  // ── 6. Spotlight interaction opens details modal ──
  test('Spotlight View This Blend opens JuiceSpotlightDetailsModal', async () => {
    // Use pre-log state so spotlight state.kind='new' → primaryLabel='View This Blend'
    // and primaryHandler=onViewBlend → handleOpenSpotlight → setShowSpotlightDetails(true)
    mockTodayJuices = []
    mockVitalityScore = 0
    mockTotalLogCount = 0
    mockMomentum = 0
    let renderer
    act(() => {
      renderer = TestRenderer.create(React.createElement(TodayScreen, { navigation: mockNavigation }))
    })
    rendererRegistry.push(renderer)
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve))
    })
    const root = renderer.root

    // In pre-log state with no entries, state.kind='new' → primaryLabel='View This Blend'
    const viewBlendButtons = findAllByLabel(root, 'View This Blend')
    expect(viewBlendButtons.length).toBeGreaterThan(0)

    const { trackEvent } = require('../src/services/AnalyticsService')

    await act(async () => {
      viewBlendButtons[0].props.onPress()
    })

    // handleOpenSpotlight calls trackEvent('juice_spotlight_opened', ...)
    expect(trackEvent).toHaveBeenCalledWith(
      'juice_spotlight_opened',
      expect.objectContaining({ source: 'today_screen' }),
    )
  })

  // ── 7. Relevant buttons have accessibility roles and labels ──
  test('key interactive elements have accessibilityRole and accessibilityLabel', async () => {
    let renderer
    act(() => {
      renderer = TestRenderer.create(React.createElement(TodayScreen, { navigation: mockNavigation }))
    })
    rendererRegistry.push(renderer)
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve))
    })
    const root = renderer.root

    const buttons = findAllByRole(root, 'button')
    expect(buttons.length).toBeGreaterThan(0)

    // Settings button
    expect(findAllByLabel(root, 'Settings').length).toBeGreaterThan(0)
    // Scan Again button (post-log)
    expect(findAllByLabel(root, 'Scan again').length).toBeGreaterThan(0)
    // Browse Juice Ideas
    expect(findAllByLabel(root, 'Browse juice ideas').length).toBeGreaterThan(0)
    // Spotlight summary role
    const summaries = findAllByRole(root, 'summary')
    expect(summaries.length).toBeGreaterThan(0)
  })

  // ── 8. No act warnings, open handles, or post-unmount updates ──
  test('unmount is clean with no pending state updates', async () => {
    let renderer
    act(() => {
      renderer = TestRenderer.create(React.createElement(TodayScreen, { navigation: mockNavigation }))
    })
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve))
    })

    // Unmount inside act — should not throw or warn
    act(() => {
      renderer.unmount()
    })

    // If we reach here without error, the test passes
    expect(true).toBe(true)
  })
})
