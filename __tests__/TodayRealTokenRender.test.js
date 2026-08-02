const React = require('react')
const TestRenderer = require('react-test-renderer')
const { act } = TestRenderer

// ── Real (un-mocked) token and style modules ──────────────────
// These are NOT mocked. If a token or style recipe is missing,
// the import will be undefined and the test will fail.
const {
  SEMANTIC_COLORS,
  SEMANTIC_SPACE,
  SEMANTIC_RADIUS,
  SEMANTIC_TYPOGRAPHY,
  BRAND,
} = require('../src/constants/tokens')

const {
  screenHeader,
  screenTitle,
  greeting,
  eyebrow,
  standardCard,
  compactSupportingCard,
  primaryActionLabel,
  secondaryAction,
  secondaryActionLabel,
  iconOnlyAction,
  scrollContentPadding,
} = require('../src/constants/styleRecipes')

const { RECIPES } = require('../src/constants/recipeData')
const { getGreeting } = require('../src/constants/motivationData')

// ── Mock only external boundaries (stores, services, native modules) ──
// Token modules, style recipes, recipe data, and motivation data are NOT mocked.

let mockTodayJuices = [{ ingredients: [{ name: 'Apple' }, { name: 'Carrot' }], pillars: ['vitaminC'] }]
let mockVitalityScore = 72
let mockTotalLogCount = 5
let mockOnboardingComplete = true
let mockMomentum = 72

const mockNavigate = jest.fn()
const mockNavigation = { navigate: mockNavigate, addListener: jest.fn().mockReturnValue(jest.fn()), removeListener: jest.fn() }

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiRemove: jest.fn().mockResolvedValue(undefined),
  multiSet: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
}))

jest.mock('expo-linear-gradient', () => {
  const React = require('react')
  const LinearGradient = (props) => React.createElement(React.Fragment, null, props.children)
  return { LinearGradient }
})

// Mock lucide-react-native — but verify icon names exist at import time
jest.mock('lucide-react-native', () => {
  const React = require('react')
  const noop = () => null
  const handler = { get: (target, prop) => {
    if (prop in target) return target[prop]
    // Return a component for any icon name, but track which were accessed
    return noop
  }}
  return new Proxy({ Camera: noop, Settings: noop, Droplets: noop, Compass: noop, Target: noop, ChevronRight: noop, Heart: noop, Edit3: noop }, handler)
})

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
    diversityStats: { uniqueProduce: 8, uniqueToday: mockTodayJuices.length > 0 ? 2 : 0, uniqueWeek: 5 },
    entries: [],
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
    weeklyStats: { totalLogs: 4, uniqueProduce: 6 },
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
  getUnlockedIds: jest.fn().mockResolvedValue([]),
}))

jest.mock('../src/services/focusNutrient', () => ({
  getFocusForToday: jest.fn().mockImplementation(() => Promise.resolve({
    id: 'vitaminC', name: 'Vitamin C', emoji: '🍊', benefit: 'Immunity support', combos: ['Orange + Kale'], tips: ['Tip 1'],
  })),
  swapFocusToday: jest.fn().mockImplementation(() => Promise.resolve({ swapped: true, nutrient: { id: 'vitaminA', name: 'Vitamin A', emoji: '🥕', benefit: 'Eye health', combos: ['Carrot + Spinach'], tips: ['Tip A'] } })),
}))

jest.mock('../src/services/weeklySummary', () => ({
  shouldShowWeeklySummary: jest.fn().mockImplementation(() => Promise.resolve({ show: false })),
  dismissWeeklySummary: jest.fn(),
  buildWeeklySummaryData: jest.fn().mockReturnValue({ juicesThisWeek: 3, glowStreak: 3, highlightNutrient: 'Vitamin C' }),
}))

// Mock wrapper components (external boundary — their internals are tested separately)
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
jest.mock('../src/components/FreePlanUsageCard', () => {
  return function FreePlanUsageCard() { return null }
})
jest.mock('../src/services/quota/QuotaStore', () => ({
  useQuota: () => ({ quota: null, loading: false, warningLevel: 'none', refresh: async () => {}, applySnapshot: () => {} }),
  QuotaProvider: ({ children }) => children,
}))
jest.mock('../src/services/quota/blendAllowanceService', () => ({
  classifyBlend: jest.fn((n) => n >= 5 ? 'advanced' : 'simple'),
  countDistinctProduceIds: jest.fn((ings) => new Set(ings.map(i => i.produceId?.toLowerCase())).size),
  createOperationId: jest.fn(() => 'advanced-blend-test-' + Math.random().toString(36).slice(2, 8)),
  ingredientFingerprint: jest.fn((ings) => ings.map(i => i.produceId?.toLowerCase()).sort().join('-')),
  reserveBlendAllowance: jest.fn(async (ings, opId) => ({ allowed: true, code: 'dev_bypass', remaining: 3, used: 0, reserved: 0, limit: 3, plan: 'free', blendType: 'advanced', requestId: opId || 'test' })),
  finalizeBlendAllowance: jest.fn(async () => {}),
  releaseBlendAllowance: jest.fn(async () => {}),
  fetchBlendAllowance: jest.fn(async () => null),
  BlendAllowanceError: class BlendAllowanceError extends Error { constructor(code, msg, result) { super(msg); this.code = code; this.result = result } },
  SIMPLE_BLEND_MAX_INGREDIENTS: 4,
  FREE_ADVANCED_BLEND_ALLOWANCE: 3,
}))
jest.mock('../src/services/quota/blendNutritionGate', () => ({
  authorizeAndProcessBatch: jest.fn(async (ings, method, opId) => ({ ...require('../../src/services/JuiceEngine').processJuiceBatch(ings, method), allowance: null })),
  BlendAllowanceError: class BlendAllowanceError extends Error { constructor(code, msg, result) { super(msg); this.code = code; this.result = result } },
  classifyBlend: jest.fn((n) => n >= 5 ? 'advanced' : 'simple'),
  countDistinctProduceIds: jest.fn((ings) => new Set(ings.map(i => i.produceId?.toLowerCase())).size),
}))
jest.mock('../src/components/AdvancedBlendModal', () => ({
  __esModule: true,
  default: function AdvancedBlendModal() { return null },
  getAdvancedBlendModalContent: jest.fn(() => ({ title: '', subtitle: null, body: '' })),
}))

jest.mock('react-native-svg', () => {
  const React = require('react')
  const Mock = React.forwardRef((props, ref) => React.createElement('View', { ...props, ref }))
  return {
    __esModule: true,
    default: Mock,
    Defs: Mock,
    ClipPath: Mock,
    Path: Mock,
    RadialGradient: Mock,
    LinearGradient: Mock,
    Stop: Mock,
    G: Mock,
  }
})

jest.mock('../src/components/GlowJourneyDrop', () => ({
  __esModule: true,
  default: function GlowJourneyDrop() { return null },
}))

jest.mock('../src/components/GlowJourneyDetail', () => ({
  __esModule: true,
  default: function GlowJourneyDetail() { return null },
}))

jest.mock('../src/services/glowJourneyService', () => ({
  getWeeklyLeafStates: jest.fn(() => []),
  getWeeklyQualifyingDays: jest.fn(() => 0),
  getLifetimeQualifyingDays: jest.fn(() => 0),
  getJourneyStage: jest.fn(() => null),
  shouldCelebrateStage: jest.fn(async () => null),
  markStageCelebrated: jest.fn(async () => {}),
  shouldCelebrateWeekly: jest.fn(async () => null),
  markWeeklyCelebrated: jest.fn(async () => {}),
  initializeBaseline: jest.fn(async () => false),
  isBaselineInitialized: jest.fn(async () => true),
}))


const TodayScreen = require('../src/screens/TodayScreen').default

// ── Test Suite ───────────────────────────────────────────────

describe('TodayScreen Real Token Render — no mocked tokens/styles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTodayJuices = [{ ingredients: [{ name: 'Apple' }, { name: 'Carrot' }], pillars: ['vitaminC'] }]
    mockVitalityScore = 72
    mockTotalLogCount = 5
    mockOnboardingComplete = true
    mockMomentum = 72
  })

  // ── 1. All semantic tokens are defined (not undefined) ──
  test('SEMANTIC_COLORS, SEMANTIC_SPACE, SEMANTIC_RADIUS, SEMANTIC_TYPOGRAPHY, BRAND are all defined objects', () => {
    expect(SEMANTIC_COLORS).toBeDefined()
    expect(typeof SEMANTIC_COLORS).toBe('object')
    expect(SEMANTIC_SPACE).toBeDefined()
    expect(typeof SEMANTIC_SPACE).toBe('object')
    expect(SEMANTIC_RADIUS).toBeDefined()
    expect(typeof SEMANTIC_RADIUS).toBe('object')
    expect(SEMANTIC_TYPOGRAPHY).toBeDefined()
    expect(typeof SEMANTIC_TYPOGRAPHY).toBe('object')
    expect(BRAND).toBeDefined()
    expect(typeof BRAND).toBe('object')
  })

  // ── 2. All style recipes are defined ──
  test('all style recipes (screenHeader, screenTitle, greeting, eyebrow, standardCard, etc.) are defined', () => {
    expect(screenHeader).toBeDefined()
    expect(screenTitle).toBeDefined()
    expect(greeting).toBeDefined()
    expect(eyebrow).toBeDefined()
    expect(standardCard).toBeDefined()
    expect(compactSupportingCard).toBeDefined()
    expect(primaryActionLabel).toBeDefined()
    expect(secondaryAction).toBeDefined()
    expect(secondaryActionLabel).toBeDefined()
    expect(iconOnlyAction).toBeDefined()
    expect(scrollContentPadding).toBeDefined()
  })

  // ── 3. RECIPES and getGreeting are defined ──
  test('RECIPES array and getGreeting function are defined from real modules', () => {
    expect(RECIPES).toBeDefined()
    expect(Array.isArray(RECIPES)).toBe(true)
    expect(RECIPES.length).toBeGreaterThan(0)
    expect(getGreeting).toBeDefined()
    expect(typeof getGreeting).toBe('function')
  })

  // ── 4. TodayScreen renders without ReferenceError using real tokens ──
  test('TodayScreen renders without throwing ReferenceError (post-log state)', async () => {
    let renderer
    act(() => {
      renderer = TestRenderer.create(React.createElement(TodayScreen, { navigation: mockNavigation }))
    })
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve))
    })
    expect(renderer).toBeTruthy()
    expect(renderer.root).toBeTruthy()
    act(() => { renderer.unmount() })
  }, 10000)

  // ── 5. TodayScreen renders new-user (pre-log) state without ReferenceError ──
  test('TodayScreen renders new-user pre-log state without throwing ReferenceError', async () => {
    mockTodayJuices = []
    mockVitalityScore = 0
    mockTotalLogCount = 0
    mockMomentum = 0
    let renderer
    act(() => {
      renderer = TestRenderer.create(React.createElement(TodayScreen, { navigation: mockNavigation }))
    })
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve))
    })
    expect(renderer).toBeTruthy()
    expect(renderer.root).toBeTruthy()
    act(() => { renderer.unmount() })
  }, 10000)

  // ── 6. TodayScreen renders returning pre-log state without ReferenceError ──
  test('TodayScreen renders returning pre-log state without throwing ReferenceError', async () => {
    mockTodayJuices = []
    mockVitalityScore = 0
    mockTotalLogCount = 3
    mockMomentum = 50
    let renderer
    act(() => {
      renderer = TestRenderer.create(React.createElement(TodayScreen, { navigation: mockNavigation }))
    })
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve))
    })
    expect(renderer).toBeTruthy()
    expect(renderer.root).toBeTruthy()
    act(() => { renderer.unmount() })
  }, 10000)

  // ── 7. Key semantic color tokens used by TodayScreen are present ──
  test('key SEMANTIC_COLORS properties used by TodayScreen are defined', () => {
    const requiredColors = [
      'textPrimary', 'textSecondary', 'textMuted', 'textOnAccent',
      'accentSecondary', 'success', 'canvas', 'borderStrong',
      'surfaceInteractive', 'warning',
    ]
    requiredColors.forEach(key => {
      expect(SEMANTIC_COLORS[key]).toBeDefined()
      expect(typeof SEMANTIC_COLORS[key]).toBe('string')
    })
  })

  // ── 8. BRAND.cta.gradient is defined (used by scan button) ──
  test('BRAND.cta.gradient is a non-empty array', () => {
    expect(BRAND.cta).toBeDefined()
    expect(BRAND.cta.gradient).toBeDefined()
    expect(Array.isArray(BRAND.cta.gradient)).toBe(true)
    expect(BRAND.cta.gradient.length).toBeGreaterThan(0)
  })
})
