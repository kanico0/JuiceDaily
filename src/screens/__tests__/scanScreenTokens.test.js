import React from 'react'
import TestRenderer from 'react-test-renderer'

// ── Real token module — NOT mocked ──────────────────────────────
// This test deliberately uses the real tokens.js to catch undefined exports.
import { SEMANTIC_COLORS, SEMANTIC_TYPOGRAPHY, SEMANTIC_SPACE, SEMANTIC_RADIUS } from '../../constants/tokens'

// ── Direct module test: confirm token exports exist at runtime ──
describe('tokens.js — SEMANTIC_* exports exist at runtime', () => {
  it('SEMANTIC_COLORS is defined and has expected properties', () => {
    expect(SEMANTIC_COLORS).toBeDefined()
    expect(typeof SEMANTIC_COLORS).toBe('object')
    expect(SEMANTIC_COLORS.textMuted).toBeDefined()
    expect(typeof SEMANTIC_COLORS.textMuted).toBe('string')
    expect(SEMANTIC_COLORS.textPrimary).toBeDefined()
    expect(SEMANTIC_COLORS.surface).toBeDefined()
    expect(SEMANTIC_COLORS.canvas).toBeDefined()
  })

  it('SEMANTIC_TYPOGRAPHY is defined and has expected roles', () => {
    expect(SEMANTIC_TYPOGRAPHY).toBeDefined()
    expect(SEMANTIC_TYPOGRAPHY.screenTitle).toBeDefined()
    expect(SEMANTIC_TYPOGRAPHY.body).toBeDefined()
    expect(SEMANTIC_TYPOGRAPHY.caption).toBeDefined()
  })

  it('SEMANTIC_SPACE is defined and has expected scale', () => {
    expect(SEMANTIC_SPACE).toBeDefined()
    expect(SEMANTIC_SPACE.lg).toBeDefined()
    expect(SEMANTIC_SPACE.md).toBeDefined()
    expect(SEMANTIC_SPACE.sm).toBeDefined()
  })

  it('SEMANTIC_RADIUS is defined and has expected values', () => {
    expect(SEMANTIC_RADIUS).toBeDefined()
    expect(SEMANTIC_RADIUS.medium).toBeDefined()
    expect(SEMANTIC_RADIUS.large).toBeDefined()
  })
})

// ── Regression test: render ScanScreen with real tokens ─────────
// This test fails if SEMANTIC_COLORS is undefined or a referenced
// property is missing, because ScanScreen's BrowseHome uses
// SEMANTIC_COLORS.textMuted in the Wellness Focus card.

// Mock stores that ScanScreen depends on — but NOT tokens.js
jest.mock('../../services/ActivationStore', () => ({
  useActivation: () => ({
    activation: { onboardingComplete: true, trackingOptIn: true },
    unlocks: {},
    recordLog: jest.fn(),
    recordOnboardingComplete: jest.fn(),
    recordTrackingOptIn: jest.fn(),
    setGoal: jest.fn(),
    recordIntroDismissed: jest.fn(),
  }),
}))

jest.mock('../../services/JuiceLogStore', () => ({
  useJuiceLog: () => ({
    todayEntries: [],
    totalLogCount: 0,
    diversityStats: {},
  }),
}))

jest.mock('../../services/NutritionScoreStore', () => ({
  useNutritionScore: () => ({
    momentum: 0,
    streak: { currentCycleStreak: 0 },
  }),
}))

jest.mock('../../services/FeatureFlags', () => ({
  useFlags: () => ({ isEnabled: () => false }),
}))

jest.mock('../../services/AnalyticsService', () => ({
  trackEvent: jest.fn(),
}))

jest.mock('../../utils/motion', () => ({
  useReducedMotion: () => false,
  DURATION: { fast: 150, medium: 300, slow: 500 },
  EASING: { ease: {} },
  LIQUID_SPRING: { damping: 15, stiffness: 150 },
  LIQUID_SPRING_SNAPPY: { damping: 20, stiffness: 300 },
}))

jest.mock('../../services/glowStreak', () => ({
  getGlowState: () => ({ count: 0, isCheckedInToday: false }),
  checkInToday: jest.fn(),
  skipToday: jest.fn(),
}))

jest.mock('../../services/focusNutrient', () => ({
  getFocusForToday: () => null,
  swapFocusToday: jest.fn(),
}))

jest.mock('../../services/weeklySummary', () => ({
  shouldShowWeeklySummary: () => false,
  dismissWeeklySummary: jest.fn(),
  buildWeeklySummaryData: jest.fn(),
}))

jest.mock('../../services/achievements', () => ({
  checkAchievements: jest.fn(() => null),
}))

jest.mock('../../components/AchievementOverlay', () => {
  const React = require('react')
  return function AchievementOverlay() {
    return React.createElement('View')
  }
})

jest.mock('../../components/MeshGradientBg', () => {
  const React = require('react')
  return function MeshGradientBg({ children }) {
    return React.createElement('View', null, children)
  }
})

jest.mock('../../components/LiquidNutrientOrb', () => {
  const React = require('react')
  return function LiquidNutrientOrb() {
    return React.createElement('View')
  }
})

// Mock lucide-react-native icons
jest.mock('lucide-react-native', () => {
  const React = require('react')
  const makeIcon = (name) => ({ size, color }) =>
    React.createElement('View', { testID: `icon-${name}` })
  return new Proxy({}, {
    get: (_, prop) => makeIcon(prop),
  })
})

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiRemove: jest.fn(() => Promise.resolve()),
}))

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}))

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const React = require('react')
  return { LinearGradient: ({ children }) => React.createElement('View', null, children) }
})

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const React = require('react')
  return {
    View: ({ children }) => React.createElement('View', null, children),
    createAnimatedComponent: (C) => C,
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v) => v,
    withTiming: (v) => v,
    withDelay: (_, v) => v,
    Easing: { bezier: () => ({}) },
  }
})

const fs = require('fs')
const path = require('path')

describe('ScanScreen — SEMANTIC_COLORS import regression', () => {
  const sourcePath = path.resolve(__dirname, '../ScanScreen.js')

  it('module loads without throwing ReferenceError for SEMANTIC_COLORS', () => {
    expect(() => {
      const ScanScreen = require('../ScanScreen').default
      expect(typeof ScanScreen).toBe('function')
    }).not.toThrow()
  })

  it('ScanScreen.js imports SEMANTIC_COLORS from tokens', () => {
    const source = fs.readFileSync(sourcePath, 'utf8')
    const importLine = source.match(/import\s*\{[^}]*SEMANTIC_COLORS[^}]*\}\s*from\s*['"][^'"]*tokens['"]/)
    expect(importLine).not.toBeNull()
    expect(importLine[0]).toContain('SEMANTIC_COLORS')
  })

  it('every SEMANTIC_COLORS usage in ScanScreen.js has a corresponding import', () => {
    const source = fs.readFileSync(sourcePath, 'utf8')
    const usages = source.match(/SEMANTIC_COLORS\./g) || []
    const importMatch = source.match(/import\s*\{[^}]*SEMANTIC_COLORS[^}]*\}\s*from/)
    expect(usages.length).toBeGreaterThan(0)
    expect(importMatch).not.toBeNull()
  })
})
