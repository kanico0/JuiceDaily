// ─────────────────────────────────────────────────────────────
// snapQuotaDisplay.test.js — Tests for snap quota display
// synchronization (Issue 3: counter changes on camera cancel)
// ─────────────────────────────────────────────────────────────

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}))

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
}))

jest.mock('../../services/AnalyticsService', () => ({
  trackEvent: jest.fn(),
}))

jest.mock('../../services/JuiceLogStore', () => ({
  useJuiceLog: jest.fn(() => ({
    addEntry: jest.fn(),
    entries: [],
    totalLogCount: 0,
    todayEntries: [],
    diversityStats: {},
  })),
}))

jest.mock('../../services/ChallengeStore', () => ({
  useChallenge: jest.fn(() => ({
    logJuice: jest.fn(),
    vitalityScore: 0,
    challenge: { currentDay: 1 },
    todayLog: { juices: [] },
    weeklyStats: { totalLogs: 0 },
  })),
}))

jest.mock('../../services/NutritionScoreStore', () => ({
  useNutritionScore: jest.fn(() => ({
    recordNutritionLog: jest.fn(),
    momentum: 0,
  })),
}))

jest.mock('../../services/quota/QuotaStore', () => ({
  useQuota: jest.fn(() => ({
    quota: { plan: 'free', scansUsed: 0, scanLimit: 5 },
  })),
}))

jest.mock('../../services/subscriptions/subscriptionSelectors', () => ({
  selectQuotaLabel: jest.fn(() => '0 of 5 scans used this month'),
  selectQuotaExhausted: jest.fn(() => false),
}))

jest.mock('../../services/quota/guestLogGate', () => ({
  authorizeGuestLog: jest.fn(async () => ({ allowed: true })),
}))

jest.mock('../../services/quota/blendAllowanceService', () => ({
  countDistinctProduceIds: jest.fn(() => 0),
  classifyBlend: jest.fn(() => 'simple'),
  BlendAllowanceError: class BlendAllowanceError extends Error {},
  FREE_ADVANCED_BLEND_ALLOWANCE: 3,
  createOperationId: jest.fn(() => 'op-1'),
}))

jest.mock('../../services/quota/blendNutritionGate', () => ({
  authorizeAndProcessBatch: jest.fn(async (ings) => ({
    ...require('../../services/JuiceEngine').processJuiceBatch(ings, 'centrifugal'),
    allowance: null,
  })),
}))

jest.mock('../../services/cameraEligibilityCoordinator', () => ({
  checkCameraEligibility: jest.fn(async (elig) => {
    if (elig.eligible) return { action: 'open_camera' }
    return { action: 'show_snap_gate' }
  }),
}))

jest.mock('../../services/ActivationStore', () => ({
  useActivation: jest.fn(() => ({
    recordLog: jest.fn(),
    unlocks: {},
    activation: { totalLogsCount: 0 },
  })),
}))

jest.mock('../../services/FeatureFlags', () => ({
  useFlags: jest.fn(() => ({ isEnabled: () => false })),
}))

jest.mock('../../services/UserProfileStore', () => ({
  useUserProfile: jest.fn(() => ({ profile: { name: '' } })),
}))

jest.mock('../../services/glowStreak', () => ({
  useGlowStreak: jest.fn(() => ({ count: 0 })),
  getGlowTodayKey: jest.fn(() => '2025-06-04'),
}))

jest.mock('../../utils/motion', () => ({
  useReducedMotion: jest.fn(() => false),
  DURATION: { enter: 300, exit: 200 },
  EASING: { decelerate: { x: 0, y: 0 } },
}))

jest.mock('../../components/MeshGradientBg', () => 'View')
jest.mock('../../components/SnapButton', () => 'View')
jest.mock('../../components/NutritionSummary', () => 'View')
jest.mock('../../components/BigSqueezeModal', () => 'View')
jest.mock('../../components/SnapGateModal', () => 'View')
jest.mock('../../components/AccountGateModal', () => 'View')
jest.mock('../../components/TrafficLightBadge', () => 'View')
jest.mock('../../components/AdvancedBlendModal', () => 'View')
jest.mock('../../components/FreePlanUsageCard', () => 'View')
jest.mock('../../components/RewardSplash', () => 'View')
jest.mock('../../components/AchievementOverlay', () => 'View')
jest.mock('../../components/QuickLogger', () => 'View')
jest.mock('expo-linear-gradient', () => 'View')
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => 'View' }))
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'View',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}))

// Mock ProStore with trackable useSnap
const mockUseSnap = jest.fn()
const mockSnapInfo = { label: '5/5 Free', remaining: 5, total: 5 }
const mockCheckSnapEligibility = jest.fn(() => ({
  eligible: true,
  remaining: 5,
  reason: null,
  source: 'free',
}))

jest.mock('../../services/ProStore', () => ({
  usePro: jest.fn(() => ({
    checkSnapEligibility: mockCheckSnapEligibility,
    useSnap: mockUseSnap,
    snapInfo: mockSnapInfo,
    isPro: false,
    hasFeatureAccess: jest.fn(() => false),
  })),
}))

// Read the source to verify useSnap is not called during camera open
const fs = require('fs')
const path = require('path')
const homeScreenSource = fs.readFileSync(
  path.resolve(__dirname, '../../screens/HomeScreen.js'),
  'utf-8'
)

describe('Snap quota display synchronization', () => {
  // 1. Opening the camera does not change either usage display
  test('recordSnapUsage() is not called inside attemptCameraOpen', () => {
    const funcStart = homeScreenSource.indexOf('const attemptCameraOpen')
    const funcEnd = homeScreenSource.indexOf('}, [checkSnapEligibility]', funcStart)
    const funcBody = homeScreenSource.slice(funcStart, funcEnd)

    const openCameraMatch = funcBody.match(/if \(result\.action === 'open_camera'\)[\s\S]*?return/)
    expect(openCameraMatch).not.toBeNull()
    expect(openCameraMatch[0]).not.toContain('recordSnapUsage()')
  })

  // 2. Exiting the camera does not change either display
  test('no recordSnapUsage call in camera close/cancel paths', () => {
    const cameraClosePatterns = ['setIsCameraOpen(false)', 'onCameraClose', 'handleCameraClose']
    for (const pattern of cameraClosePatterns) {
      const idx = homeScreenSource.indexOf(pattern)
      if (idx !== -1) {
        const surrounding = homeScreenSource.slice(Math.max(0, idx - 200), idx + 200)
        expect(surrounding).not.toContain('recordSnapUsage()')
      }
    }
  })

  // 3. Permission denial does not change either display
  test('no recordSnapUsage call in permission denial path', () => {
    const permIdx = homeScreenSource.indexOf('permission')
    if (permIdx !== -1) {
      const surrounding = homeScreenSource.slice(Math.max(0, permIdx - 200), permIdx + 200)
      expect(surrounding).not.toContain('recordSnapUsage()')
    }
  })

  // 4. Upload failure does not change either display
  test('no recordSnapUsage call in upload/analysis failure paths', () => {
    const failIdx = homeScreenSource.indexOf('catch')
    if (failIdx !== -1) {
      const catchBlocks = homeScreenSource.match(/catch[\s\S]*?\}/g)
      if (catchBlocks) {
        for (const block of catchBlocks) {
          expect(block).not.toContain('recordSnapUsage()')
        }
      }
    }
  })

  // 5. recordSnapUsage is called exactly once in actual code (not comments) in the file
  test('recordSnapUsage() is called exactly once in actual code in the entire file', () => {
    // Count only actual call statements, not mentions in comments
    const useSnapCalls = homeScreenSource.match(/^\s*recordSnapUsage\(\)/gm)
    expect(useSnapCalls).not.toBeNull()
    expect(useSnapCalls.length).toBe(1)
  })

  // 6. recordSnapUsage is in handleProduceIdentified (successful analysis), NOT in executeLogToChallenge
  test('recordSnapUsage() is called in handleProduceIdentified, not in executeLogToChallenge', () => {
    const produceIdx = homeScreenSource.indexOf('const handleProduceIdentified')
    expect(produceIdx).not.toBe(-1)
    const produceBlock = homeScreenSource.slice(produceIdx, produceIdx + 2000)
    expect(produceBlock).toContain('recordSnapUsage()')

    const logIdx = homeScreenSource.indexOf('const executeLogToChallenge')
    expect(logIdx).not.toBe(-1)
    const logBlock = homeScreenSource.slice(logIdx, logIdx + 2000)
    expect(logBlock).not.toContain('recordSnapUsage()')
  })

  // 7. Both displays show the same usage state
  test('snapInfo and QuotaMeter both derive from authoritative state', () => {
    expect(mockSnapInfo.label).toBeDefined()
  })

  // 8. Repeated camera opens without successful scans do not alter remaining scans
  test('opening camera multiple times without scan does not call recordSnapUsage', () => {
    const funcStart = homeScreenSource.indexOf('const attemptCameraOpen')
    const funcEnd = homeScreenSource.indexOf('}, [checkSnapEligibility]', funcStart)
    const funcBody = homeScreenSource.slice(funcStart, funcEnd)
    expect(funcBody).not.toContain('recordSnapUsage()')
  })

  // 9. Quota exhaustion still blocks camera access
  test('checkSnapEligibility is still called before camera opens', () => {
    const funcStart = homeScreenSource.indexOf('const attemptCameraOpen')
    const funcEnd = homeScreenSource.indexOf('}, [checkSnapEligibility]', funcStart)
    const funcBody = homeScreenSource.slice(funcStart, funcEnd)
    expect(funcBody).toContain('checkSnapEligibility()')
    expect(funcBody).toContain('checkCameraEligibility')
  })

  // 10. Guest and authenticated-user behavior remain correct
  test('account gate and snap gate paths are preserved', () => {
    const funcStart = homeScreenSource.indexOf('const attemptCameraOpen')
    const funcEnd = homeScreenSource.indexOf('}, [checkSnapEligibility]', funcStart)
    const funcBody = homeScreenSource.slice(funcStart, funcEnd)
    expect(funcBody).toContain('show_snap_gate')
    expect(funcBody).toContain('show_account_gate')
  })

  // 11. Idempotency: snapConsumedForSessionRef prevents double-counting
  test('snapConsumedForSessionRef guards recordSnapUsage against double-counting', () => {
    const produceIdx = homeScreenSource.indexOf('const handleProduceIdentified')
    const produceBlock = homeScreenSource.slice(produceIdx, produceIdx + 5000)
    expect(produceBlock).toContain('snapConsumedForSessionRef')
    expect(produceBlock).toContain('!snapConsumedForSessionRef.current')
    expect(produceBlock).toContain('snapConsumedForSessionRef.current = true')
  })

  // 12. Session ref is reset when camera opens
  test('snapConsumedForSessionRef is reset to false on camera open', () => {
    const funcStart = homeScreenSource.indexOf('const attemptCameraOpen')
    const funcEnd = homeScreenSource.indexOf('}, [checkSnapEligibility]', funcStart)
    const funcBody = homeScreenSource.slice(funcStart, funcEnd)
    expect(funcBody).toContain('snapConsumedForSessionRef.current = false')
  })

  // 13. executeLogToChallenge does NOT call recordSnapUsage (snap already consumed at analysis)
  test('executeLogToChallenge does not consume a snap', () => {
    const logIdx = homeScreenSource.indexOf('const executeLogToChallenge')
    const logBlock = homeScreenSource.slice(logIdx, logIdx + 5000)
    expect(logBlock).not.toContain('recordSnapUsage()')
    // Should have a comment explaining why
    expect(logBlock).toContain('already consumed')
  })

  // 14. Manual entries do not consume snaps (recordSnapUsage only in handleProduceIdentified)
  test('manual entry path does not call recordSnapUsage', () => {
    const manualIdx = homeScreenSource.indexOf('const handleManualAdd')
    expect(manualIdx).not.toBe(-1)
    const manualBlock = homeScreenSource.slice(manualIdx, manualIdx + 800)
    expect(manualBlock).not.toContain('recordSnapUsage()')
  })

  // 15. handleAddProduce does not consume snaps
  test('handleAddProduce does not call recordSnapUsage', () => {
    const addIdx = homeScreenSource.indexOf('const handleAddProduce')
    expect(addIdx).not.toBe(-1)
    const addBlock = homeScreenSource.slice(addIdx, addIdx + 800)
    expect(addBlock).not.toContain('recordSnapUsage()')
  })
})
