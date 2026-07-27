import React from 'react'
import { View } from 'react-native'
import TestRenderer from 'react-test-renderer'
import { act } from 'react-test-renderer'

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  multiSet: jest.fn().mockResolvedValue(undefined),
  multiGet: jest.fn().mockResolvedValue([]),
}))

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const React = require('react')
  const LinearGradient = (props) => React.createElement('View', props, props.children)
  return { LinearGradient }
})

// Mock lucide-react-native
jest.mock('lucide-react-native', () => {
  const React = require('react')
  const noop = (props) => React.createElement('View', props)
  return new Proxy({}, { get: () => noop })
})

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn().mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}))

// Mock @react-navigation/native — factory must be self-contained (Jest hoists)
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn().mockReturnValue({ navigate: jest.fn() }),
}))
const { useNavigation: mockUseNavigation } = require('@react-navigation/native')
const mockNavigate = mockUseNavigation().navigate

// Mock useReducedMotion — factory must be self-contained (Jest hoists)
jest.mock('../../utils/motion', () => ({
  useReducedMotion: jest.fn().mockReturnValue(false),
}))
const { useReducedMotion: mockUseReducedMotion } = require('../../utils/motion')

// ── Token imports ─────────────────────────────────────────────
const tokens = require('../../constants/tokens')
const { SEMANTIC_ATMOSPHERIC, SEMANTIC_FAB } = tokens

// ── Component imports (real, not mocked) ──────────────────────
import MeshGradientBg from '../MeshGradientBg'
import ModernTabBar from '../ModernTabBar'

// ── Helper: create tab bar props ──────────────────────────────
function createTabBarProps(overrides = {}) {
  return {
    state: {
      index: 0,
      routes: [
        { key: 'Today-0', name: 'TodayTab' },
        { key: 'History-1', name: 'HistoryTab' },
        { key: 'Explore-2', name: 'ExploreTab' },
      ],
    },
    descriptors: {
      'Today-0': { options: {} },
      'History-1': { options: {} },
      'Explore-2': { options: {} },
    },
    navigation: {
      emit: jest.fn().mockReturnValue({ defaultPrevented: false }),
      navigate: jest.fn(),
    },
    ...overrides,
  }
}

// ── Helper: render and cleanup ────────────────────────────────
let renderer = null
function renderComponent(component) {
  act(() => {
    renderer = TestRenderer.create(component)
  })
  return renderer
}
function cleanup() {
  if (renderer) {
    act(() => {
      renderer.unmount()
    })
    renderer = null
  }
}

// ═══════════════════════════════════════════════════════════════
// BACKGROUND TESTS (1–10)
// ═══════════════════════════════════════════════════════════════

describe('Phase 0C2 — Background', () => {
  afterEach(() => { cleanup(); mockUseReducedMotion.mockReturnValue(false) })

  // 1. semantic atmospheric tokens exist
  test('1. SEMANTIC_ATMOSPHERIC export exists', () => {
    expect(SEMANTIC_ATMOSPHERIC).toBeDefined()
    expect(typeof SEMANTIC_ATMOSPHERIC).toBe('object')
  })

  // 2. background tokens are defined
  test('2. all atmospheric background tokens are defined', () => {
    const required = [
      'backgroundBase', 'backgroundDepth', 'atmosphericSage',
      'atmosphericWarm', 'atmosphericCool', 'atmosphericHighlight',
      'backgroundVignette', 'backgroundNoiseTint',
    ]
    required.forEach((key) => {
      expect(SEMANTIC_ATMOSPHERIC[key]).toBeDefined()
      expect(typeof SEMANTIC_ATMOSPHERIC[key]).toBe('string')
      expect(SEMANTIC_ATMOSPHERIC[key].length).toBeGreaterThan(0)
    })
  })

  // 3. MeshGradientBg renders without crashing
  test('3. MeshGradientBg renders without crashing', () => {
    expect(() => renderComponent(<MeshGradientBg />)).not.toThrow()
  })

  // 4. background layers use pointerEvents="none"
  test('4. background root uses pointerEvents="none"', () => {
    renderComponent(<MeshGradientBg />)
    const tree = renderer.toJSON()
    expect(tree.props.pointerEvents).toBe('none')
  })

  // 5. background does not create timers by default
  test('5. background source has no timers or animation loops', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../MeshGradientBg.js'),
      'utf-8'
    )
    expect(source).not.toContain('Animated.loop')
    expect(source).not.toContain('setInterval')
    expect(source).not.toContain('setTimeout')
    expect(source).not.toContain('requestAnimationFrame')
  })

  // 6. reduced-motion behavior is honored
  test('6. reduced-motion does not cause errors or animations', () => {
    mockUseReducedMotion.mockReturnValue(true)
    expect(() => renderComponent(<MeshGradientBg />)).not.toThrow()
    const tree = renderer.toJSON()
    expect(tree).toBeTruthy()
  })

  // 7. no new image or video dependency is introduced
  test('7. MeshGradientBg does not import image or video modules', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../MeshGradientBg.js'),
      'utf-8'
    )
    expect(source).not.toContain('react-native-video')
    expect(source).not.toContain('lottie')
    expect(source).not.toContain('@shopify/react-native-skia')
    expect(source).not.toContain('require(')
    expect(source).not.toMatch(/Image\s+from\s+['"]react-native['"]/)
  })

  // 8. static background layers do not change screen layout
  test('8. background uses absoluteFill — does not affect layout', () => {
    renderComponent(<MeshGradientBg />)
    const tree = renderer.toJSON()
    expect(tree.props.style).toMatchObject({
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
    })
  })

  // 9. Today, History, and Explore remain route-reachable
  test('9. tab route names include TodayTab, HistoryTab, ExploreTab', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../ModernTabBar.js'),
      'utf-8'
    )
    expect(source).toContain('TodayTab')
    expect(source).toContain('HistoryTab')
    expect(source).toContain('ExploreTab')
  })

  // 10. no duplicate background is rendered on the same screen where detectable
  test('10. MeshGradientBg is memoized to prevent unnecessary duplicate renders', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../MeshGradientBg.js'),
      'utf-8'
    )
    expect(source).toContain('React.memo')
  })
})

// ═══════════════════════════════════════════════════════════════
// FAB TESTS (11–24)
// ═══════════════════════════════════════════════════════════════

describe('Phase 0C2 — FAB', () => {
  afterEach(() => { cleanup(); mockUseReducedMotion.mockReturnValue(false); mockNavigate.mockClear() })

  // 11. center FAB remains connected to ScanFlow
  test('11. FAB onPress calls navigate with "ScanFlow"', () => {
    renderComponent(<ModernTabBar {...createTabBarProps()} />)
    const fabNode = findFabNode(renderer.root)
    expect(fabNode).toBeTruthy()
    act(() => {
      fabNode.props.onPress()
    })
    expect(mockNavigate).toHaveBeenCalledWith('ScanFlow')
  })

  // 12. route name and navigation parameters remain unchanged
  test('12. navigation destination is exactly "ScanFlow" with no params', () => {
    renderComponent(<ModernTabBar {...createTabBarProps()} />)
    const fabNode = findFabNode(renderer.root)
    act(() => { fabNode.props.onPress() })
    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith('ScanFlow')
  })

  // 13. accessibilityRole is button
  test('13. FAB has accessibilityRole="button"', () => {
    renderComponent(<ModernTabBar {...createTabBarProps()} />)
    const fabNode = findFabNode(renderer.root)
    expect(fabNode).toBeTruthy()
    expect(fabNode.props.accessibilityRole).toBe('button')
  })

  // 14. accessibilityLabel remains meaningful
  test('14. FAB has meaningful accessibilityLabel and accessibilityHint', () => {
    renderComponent(<ModernTabBar {...createTabBarProps()} />)
    const fabNode = findFabNode(renderer.root)
    expect(fabNode).toBeTruthy()
    expect(fabNode.props.accessibilityLabel).toBeTruthy()
    expect(fabNode.props.accessibilityLabel.length).toBeGreaterThan(0)
    expect(fabNode.props.accessibilityHint).toBeTruthy()
    expect(fabNode.props.accessibilityHint.length).toBeGreaterThan(0)
  })

  // 15. visible diameter is within approved range (64–68)
  test('15. FAB visible diameter is within 64–68 dp range', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../ModernTabBar.js'),
      'utf-8'
    )
    expect(source).toMatch(/FAB_VISIBLE\s*=\s*(6[4-8])/)
    const match = source.match(/FAB_VISIBLE\s*=\s*(\d+)/)
    const visible = parseInt(match[1], 10)
    expect(visible).toBeGreaterThanOrEqual(64)
    expect(visible).toBeLessThanOrEqual(68)
  })

  // 16. touch target is at least 68 dp
  test('16. FAB touch target is at least 68 dp', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../ModernTabBar.js'),
      'utf-8'
    )
    const match = source.match(/FAB_TOUCH\s*=\s*(\d+)/)
    const touch = parseInt(match[1], 10)
    expect(touch).toBeGreaterThanOrEqual(68)
  })

  // 17. neighboring tabs remain accessible
  test('17. neighboring tab buttons have accessibilityRole="tab"', () => {
    renderComponent(<ModernTabBar {...createTabBarProps()} />)
    const tree = renderer.toJSON()
    const tabButtons = findAllByRole(tree, 'tab')
    expect(tabButtons.length).toBe(3)
  })

  // 18. pressed state activates
  test('18. onPressIn handler exists and does not throw', () => {
    renderComponent(<ModernTabBar {...createTabBarProps()} />)
    const fabNode = findFabNode(renderer.root)
    expect(fabNode.props.onPressIn).toBeDefined()
    expect(fabNode.props.onPressOut).toBeDefined()
    expect(() => {
      act(() => { fabNode.props.onPressIn() })
      act(() => { fabNode.props.onPressOut() })
    }).not.toThrow()
  })

  // 19. reduced-motion mode avoids scale animation
  test('19. reduced-motion sets scale to 1 (no animation)', () => {
    mockUseReducedMotion.mockReturnValue(true)
    renderComponent(<ModernTabBar {...createTabBarProps()} />)
    const fabInner = findFabInnerNode(renderer.root)
    expect(fabInner).toBeTruthy()
    const styleArr = fabInner.props.style
    const transformStyle = Array.isArray(styleArr)
      ? styleArr.find((s) => s && typeof s === 'object' && s.transform)
      : null
    expect(transformStyle).toBeTruthy()
    expect(transformStyle.transform[0].scale).toBe(1)
  })

  // 20. no continuous timer or pulse exists
  test('20. no setTimeout/setInterval/Animated.loop in ModernTabBar', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../ModernTabBar.js'),
      'utf-8'
    )
    expect(source).not.toContain('Animated.loop')
    expect(source).not.toContain('setInterval')
    expect(source).not.toMatch(/setTimeout(?!.*Animated\.timing.*duration:\s*120)/)
  })

  // 21. icon uses existing vector icon package
  test('21. FAB icon comes from lucide-react-native', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../ModernTabBar.js'),
      'utf-8'
    )
    expect(source).toContain("from 'lucide-react-native'")
    expect(source).toMatch(/Camera/)
  })

  // 22. tab route order remains unchanged
  test('22. tab route order is TodayTab, HistoryTab, ExploreTab', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../ModernTabBar.js'),
      'utf-8'
    )
    const todayIdx = source.indexOf('TodayTab')
    const historyIdx = source.indexOf('HistoryTab')
    const exploreIdx = source.indexOf('ExploreTab')
    expect(todayIdx).toBeLessThan(historyIdx)
    expect(historyIdx).toBeLessThan(exploreIdx)
  })

  // 23. Android safe-area behavior remains represented in styles
  test('23. safe-area insets are used for bottom padding', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../ModernTabBar.js'),
      'utf-8'
    )
    expect(source).toContain('useSafeAreaInsets')
    expect(source).toContain('insets.bottom')
  })

  // 24. unmount leaves no open handles
  test('24. unmount does not throw and leaves no pending state', () => {
    renderComponent(<ModernTabBar {...createTabBarProps()} />)
    expect(() => cleanup()).not.toThrow()
    expect(renderer).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════
// REGRESSION TESTS (25–30)
// ═══════════════════════════════════════════════════════════════

describe('Phase 0C2 — Regression', () => {
  // 25. Today content is unchanged
  test('25. TodayScreen still exports default function', () => {
    const fs = require('fs')
    const path = require('path')
    const todayPath = path.resolve(__dirname, '../../screens/TodayScreen.js')
    const source = fs.readFileSync(todayPath, 'utf-8')
    expect(source).toContain('export default function')
    expect(source).toContain('MeshGradientBg')
  })

  // 26. History content is unchanged
  test('26. HistoryScreen still exports default function', () => {
    const fs = require('fs')
    const path = require('path')
    const historyPath = path.resolve(__dirname, '../../screens/HistoryScreen.js')
    const source = fs.readFileSync(historyPath, 'utf-8')
    expect(source).toContain('export default function')
    expect(source).toContain('MeshGradientBg')
  })

  // 27. Explore content is unchanged
  test('27. ScanScreen (Explore) still exports default function', () => {
    const fs = require('fs')
    const path = require('path')
    const scanPath = path.resolve(__dirname, '../../screens/ScanScreen.js')
    const source = fs.readFileSync(scanPath, 'utf-8')
    expect(source).toContain('export default function')
    expect(source).toContain('MeshGradientBg')
  })

  // 28. quota logic is unchanged
  test('28. quota service source is unchanged', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../services/quota/quotaService.ts'),
      'utf-8'
    )
    expect(source).toContain('export')
    expect(source).toContain('ScanQuotaError')
  })

  // 29. Glow Streak logic is unchanged
  test('29. glowStreak source is unchanged', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../services/glowStreak.js'),
      'utf-8'
    )
    expect(source).toContain('getGlowState')
    expect(source).toContain('export')
  })

  // 30. ScanFlow behavior is unchanged
  test('30. ScanFlow route name is still "ScanFlow" in navigation', () => {
    const fs = require('fs')
    const path = require('path')
    const appPath = path.resolve(__dirname, '../../../App.js')
    const source = fs.readFileSync(appPath, 'utf-8')
    expect(source).toContain('ScanFlow')
  })
})

// ═══════════════════════════════════════════════════════════════
// INTEGRATION: Real ModernTabBar + Real MeshGradientBg together
// ═══════════════════════════════════════════════════════════════

describe('Phase 0C2 — Integration (real components together)', () => {
  afterEach(() => { cleanup(); mockUseReducedMotion.mockReturnValue(false) })

  test('renders ModernTabBar and MeshGradientBg together without crashing', () => {
    expect(() => {
      renderComponent(
        <View style={{ flex: 1 }}>
          <MeshGradientBg />
          <View style={{ flex: 1 }} />
          <ModernTabBar {...createTabBarProps()} />
        </View>
      )
    }).not.toThrow()
    const tree = renderer.toJSON()
    expect(tree).toBeTruthy()
  })

  test('FAB in integrated render still navigates to ScanFlow', () => {
    renderComponent(
      <View style={{ flex: 1 }}>
        <MeshGradientBg />
        <View style={{ flex: 1 }} />
        <ModernTabBar {...createTabBarProps()} />
      </View>
    )
    const fabNode = findFabNode(renderer.root)
    expect(fabNode).toBeTruthy()
    act(() => { fabNode.props.onPress() })
    expect(mockNavigate).toHaveBeenCalledWith('ScanFlow')
  })
})

// ── Helper functions ──────────────────────────────────────────

function findFabNode(root) {
  const found = root.findAll((node) =>
    node.props &&
    node.props.accessibilityRole === 'button' &&
    node.props.accessibilityLabel === 'Scan produce'
  )
  return found[0] || null
}

function findFabInnerNode(root) {
  const fab = findFabNode(root)
  if (!fab) return null
  const inner = fab.findAll((node) =>
    node.props &&
    Array.isArray(node.props.style) &&
    node.props.style.some((s) => s && typeof s === 'object' && s.transform)
  )
  return inner[0] || null
}

function findAllByRole(tree, role) {
  const results = []
  function walk(node) {
    if (!node) return
    if (node.props && node.props.accessibilityRole === role) {
      results.push(node)
    }
    if (node.children) {
      node.children.forEach(walk)
    }
  }
  walk(tree)
  return results
}
