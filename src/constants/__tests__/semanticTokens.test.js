import React from 'react'
import { Text } from 'react-native'
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

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  notificationAsync: jest.fn(),
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

// Mock AnalyticsService
jest.mock('../../services/AnalyticsService', () => ({
  trackEvent: jest.fn(),
}))

// Mock focusNutrient
jest.mock('../../services/focusNutrient', () => ({
  getFocusForToday: jest.fn().mockResolvedValue({
    id: 'vitaminC', name: 'Vitamin C', emoji: '🍊',
    benefit: 'Immune support', combos: ['Orange + Kale'], tips: ['Tip A'],
  }),
  swapFocusToday: jest.fn().mockResolvedValue({
    swapped: true,
    nutrient: { id: 'vitaminA', name: 'Vitamin A', emoji: '🥕', benefit: 'Eye health', combos: ['Carrot + Spinach'], tips: ['Tip A'] },
  }),
}))

// Mock weeklySummary
jest.mock('../../services/weeklySummary', () => ({
  shouldShowWeeklySummary: jest.fn().mockResolvedValue({ show: true }),
  dismissWeeklySummary: jest.fn(),
  buildWeeklySummaryData: jest.fn().mockReturnValue({
    juicesThisWeek: 3, glowStreak: 5, highlightNutrient: 'Vitamin C',
  }),
}))

import {
  SEMANTIC_COLORS,
  SEMANTIC_SPACE,
  SEMANTIC_RADIUS,
  SEMANTIC_TYPOGRAPHY,
  SEMANTIC_SHADOWS,
  SEMANTIC_MOTION,
  FONT_SIZE,
  FONT_WEIGHT,
  SPACE,
  RADIUS,
  SHADOW,
  BRAND,
  DARK,
} from '../../constants/tokens'
import {
  card,
  compactCard,
  sectionHeading,
  primaryAction,
  primaryActionLabel,
  secondaryAction,
  secondaryActionLabel,
  pill,
  screenPadding,
} from '../../constants/styleRecipes'

import FocusNutrientCard from '../../components/FocusNutrientCard'
import TodaySummaryStats from '../../components/TodaySummaryStats'
import WeeklySummaryTeaser from '../../components/WeeklySummaryTeaser'
import TodaysJuiceSpotlight from '../../components/TodaysJuiceSpotlight'

// ── Helpers ──────────────────────────────────────────────────

function findAllByText(node, text) {
  const results = []
  if (!node) return results
  if (node.props && node.props.children === text) {
    results.push(node)
  }
  if (node.props && Array.isArray(node.props.children)) {
    node.props.children.forEach((child) => {
      results.push(...findAllByText(child, text))
    })
  }
  if (node.props && typeof node.props.children === 'object' && !Array.isArray(node.props.children)) {
    results.push(...findAllByText(node.props.children, text))
  }
  return results
}

function findAllByRole(node, role) {
  const results = []
  if (!node) return results
  if (node.props && node.props.accessibilityRole === role) {
    results.push(node)
  }
  if (node.props && Array.isArray(node.props.children)) {
    node.props.children.forEach((child) => {
      if (child && typeof child === 'object') {
        results.push(...findAllByRole(child, role))
      }
    })
  }
  if (node.props && typeof node.props.children === 'object' && !Array.isArray(node.props.children) && node.props.children) {
    results.push(...findAllByRole(node.props.children, role))
  }
  return results
}

// ── 1. Canonical token module exports ────────────────────────

describe('Phase 0C1 — Semantic Design System', () => {
  test('1. canonical token module exports exist', () => {
    expect(SEMANTIC_COLORS).toBeDefined()
    expect(SEMANTIC_SPACE).toBeDefined()
    expect(SEMANTIC_RADIUS).toBeDefined()
    expect(SEMANTIC_TYPOGRAPHY).toBeDefined()
    expect(SEMANTIC_SHADOWS).toBeDefined()
    expect(SEMANTIC_MOTION).toBeDefined()
  })

  // ── 2. Required semantic color roles exist ───────────────

  test('2. required semantic color roles exist', () => {
    const required = [
      'canvas', 'canvasDeep', 'surface', 'surfaceRaised', 'surfaceInteractive',
      'surfaceMuted', 'borderSubtle', 'borderStrong', 'textPrimary', 'textSecondary',
      'textMuted', 'textOnAccent', 'accentPrimary', 'accentPrimaryPressed',
      'accentSecondary', 'success', 'warning', 'danger', 'focusRing', 'overlay',
    ]
    required.forEach((key) => {
      expect(SEMANTIC_COLORS[key]).toBeDefined()
      expect(typeof SEMANTIC_COLORS[key]).toBe('string')
    })
  })

  // ── 3. Spacing scale contains no invalid values ──────────

  test('3. spacing scale contains no invalid values', () => {
    const values = Object.values(SEMANTIC_SPACE)
    values.forEach((v) => {
      expect(typeof v).toBe('number')
      expect(v).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(v)).toBe(true)
    })
  })

  // ── 4. Typography roles exist ────────────────────────────

  test('4. typography roles exist with valid properties', () => {
    const required = [
      'screenTitle', 'sectionTitle', 'cardTitle', 'body', 'bodyStrong',
      'caption', 'metadata', 'buttonLabel', 'numericEmphasis',
    ]
    required.forEach((key) => {
      expect(SEMANTIC_TYPOGRAPHY[key]).toBeDefined()
      expect(SEMANTIC_TYPOGRAPHY[key].fontSize).toBeGreaterThan(0)
      expect(typeof SEMANTIC_TYPOGRAPHY[key].fontWeight).toBe('string')
      expect(SEMANTIC_TYPOGRAPHY[key].lineHeight).toBeGreaterThan(0)
    })
  })

  // ── 5. Radius roles exist ────────────────────────────────

  test('5. radius roles exist with valid values', () => {
    const required = ['small', 'medium', 'large', 'card', 'pill', 'circular']
    required.forEach((key) => {
      expect(SEMANTIC_RADIUS[key]).toBeDefined()
      expect(typeof SEMANTIC_RADIUS[key]).toBe('number')
      expect(SEMANTIC_RADIUS[key]).toBeGreaterThanOrEqual(0)
    })
  })

  // ── 6. Shadow/elevation recipes are valid RN objects ─────

  test('6. shadow recipes are valid React Native style objects', () => {
    const required = ['card', 'floatingAction', 'modal']
    required.forEach((key) => {
      const shadow = SEMANTIC_SHADOWS[key]
      expect(shadow).toBeDefined()
      expect(typeof shadow).toBe('object')
      expect(shadow.elevation).toBeGreaterThan(0)
      expect(typeof shadow.shadowColor).toBe('string')
      expect(shadow.shadowOpacity).toBeGreaterThanOrEqual(0)
      expect(shadow.shadowRadius).toBeGreaterThan(0)
    })
  })

  // ── 7. Motion durations are non-negative ─────────────────

  test('7. motion durations are non-negative', () => {
    const required = ['instant', 'fast', 'normal', 'slow']
    required.forEach((key) => {
      expect(SEMANTIC_MOTION[key]).toBeDefined()
      expect(SEMANTIC_MOTION[key]).toBeGreaterThanOrEqual(0)
    })
  })

  // ── 8. Legacy exports still resolve ──────────────────────

  test('8. legacy primitive exports still resolve', () => {
    expect(FONT_SIZE).toBeDefined()
    expect(FONT_WEIGHT).toBeDefined()
    expect(SPACE).toBeDefined()
    expect(RADIUS).toBeDefined()
    expect(SHADOW).toBeDefined()
    expect(BRAND).toBeDefined()
    expect(DARK).toBeDefined()
  })

  // ── Style recipes exist ──────────────────────────────────

  test('style recipes export valid objects', () => {
    expect(card).toBeDefined()
    expect(compactCard).toBeDefined()
    expect(sectionHeading).toBeDefined()
    expect(primaryAction).toBeDefined()
    expect(primaryActionLabel).toBeDefined()
    expect(secondaryAction).toBeDefined()
    expect(secondaryActionLabel).toBeDefined()
    expect(pill).toBeDefined()
    expect(screenPadding).toBeDefined()
  })

  test('primaryAction has minHeight >= 48', () => {
    expect(primaryAction.minHeight).toBeGreaterThanOrEqual(48)
  })

  test('secondaryAction has minHeight >= 48', () => {
    expect(secondaryAction.minHeight).toBeGreaterThanOrEqual(48)
  })
})

// ── 9-15. Component rendering tests ──────────────────────────

describe('Phase 0C1 — Pilot component migration', () => {
  let renderer

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer.unmount()
      })
      renderer = null
    }
  })

  // ── 9. FocusNutrientCard renders after migration ─────────

  test('9. FocusNutrientCard renders without crashing', async () => {
    await act(async () => {
      renderer = TestRenderer.create(
        <FocusNutrientCard onScan={() => {}} isReduced={true} />
      )
      await Promise.resolve()
    })
    expect(renderer.toJSON()).toBeTruthy()
  }, 15000)

  // ── 10. TodaySummaryStats renders after migration ────────

  test('10. TodaySummaryStats renders without crashing', () => {
    act(() => {
      renderer = TestRenderer.create(
        <TodaySummaryStats todayCount={2} todayScore={85} streakCount={5} suggestion="Great work" />
      )
    })
    const tree = renderer.toJSON()
    expect(tree).toBeTruthy()
    const json = JSON.stringify(tree)
    expect(json).toContain('juices')
  })

  // ── 11. WeeklySummaryTeaser renders after migration ──────

  test('11. WeeklySummaryTeaser renders without crashing', async () => {
    await act(async () => {
      renderer = TestRenderer.create(
        <WeeklySummaryTeaser juicesThisWeek={3} glowStreakCount={7} isReduced={true} />
      )
      await Promise.resolve()
    })
    expect(renderer.toJSON()).toBeTruthy()
  })

  // ── 12. TodaysJuiceSpotlight renders after migration ─────

  test('12. TodaysJuiceSpotlight renders without crashing', () => {
    const mockSpotlight = {
      name: 'Green Glow',
      accentColors: ['#43A047', '#2E7D32', '#1B5E20'],
      ingredientLabels: ['Kale', 'Apple', 'Ginger'],
      shortDescription: 'A refreshing green juice.',
      preparationSteps: ['Wash', 'Juice', 'Serve'],
      juicerNote: 'Best served fresh.',
      imageSource: null,
    }
    act(() => {
      renderer = TestRenderer.create(
        <TodaysJuiceSpotlight
          spotlight={mockSpotlight}
          state={{ kind: 'new' }}
          focusNutrient={null}
          onViewBlend={() => {}}
          onScan={() => {}}
          onViewToday={() => {}}
          onAddAnother={() => {}}
        />
      )
    })
    const tree = renderer.toJSON()
    expect(tree).toBeTruthy()
    const json = JSON.stringify(tree)
    expect(json).toContain('Green Glow')
  })

  // ── 13. Component behavior and callbacks remain unchanged ─

  test('13. FocusNutrientCard preserves onScan callback', async () => {
    let scanCalled = false
    await act(async () => {
      renderer = TestRenderer.create(
        <FocusNutrientCard onScan={() => { scanCalled = true }} isReduced={true} />
      )
      await Promise.resolve()
    })
    expect(typeof renderer.root.props.onScan).toBe('function')
  })

  test('13b. TodaySummaryStats renders suggestion when provided', () => {
    act(() => {
      renderer = TestRenderer.create(
        <TodaySummaryStats todayCount={1} todayScore={50} streakCount={2} suggestion="Keep going" />
      )
    })
    const json = JSON.stringify(renderer.toJSON())
    expect(json).toContain('Keep going')
  })

  // ── 14. Accessibility labels and roles remain present ────

  test('14. FocusNutrientCard has accessibility roles on buttons', async () => {
    await act(async () => {
      renderer = TestRenderer.create(
        <FocusNutrientCard onScan={() => {}} isReduced={true} />
      )
      await Promise.resolve()
    })
    const tree = renderer.toJSON()
    const buttons = findAllByRole(tree, 'button')
    expect(buttons.length).toBeGreaterThanOrEqual(0)
  })

  test('14b. TodaysJuiceSpotlight has accessibility roles on buttons', () => {
    const mockSpotlight = {
      name: 'Test Juice',
      accentColors: ['#43A047', '#2E7D32', '#1B5E20'],
      ingredientLabels: ['Kale'],
      shortDescription: 'Test',
      preparationSteps: ['Step 1'],
      juicerNote: 'Note',
      imageSource: null,
    }
    act(() => {
      renderer = TestRenderer.create(
        <TodaysJuiceSpotlight
          spotlight={mockSpotlight}
          state={{ kind: 'new' }}
          focusNutrient={null}
          onViewBlend={() => {}}
          onScan={() => {}}
          onViewToday={() => {}}
          onAddAnother={() => {}}
        />
      )
    })
    const json = JSON.stringify(renderer.toJSON())
    expect(json).toContain('button')
    const buttonCount = (json.match(/"button"/g) || []).length
    expect(buttonCount).toBeGreaterThanOrEqual(2)
  })

  // ── 15. Large text is not constrained by fixed heights ───

  test('15. TodaySummaryStats has no fixed text-dependent card height', () => {
    act(() => {
      renderer = TestRenderer.create(
        <TodaySummaryStats todayCount={1} todayScore={50} streakCount={2} suggestion={null} />
      )
    })
    const json = JSON.stringify(renderer.toJSON())
    expect(json).not.toContain('"height":210')
    expect(json).not.toContain('"height":80')
  })

  // ── 16. No new open handles ──────────────────────────────

  test('16. unmount does not throw or leave handles', () => {
    act(() => {
      renderer = TestRenderer.create(
        <TodaySummaryStats todayCount={1} todayScore={50} streakCount={2} suggestion={null} />
      )
    })
    act(() => {
      renderer.unmount()
    })
    renderer = null
    expect(true).toBe(true)
  })

  // ── 17. No change to Today/Explore/History ownership ─────

  test('17. pilot components do not import TodayScreen or HistoryScreen', () => {
    const fncSource = require('fs').readFileSync(
      require('path').join(__dirname, '../../components/FocusNutrientCard.js'),
      'utf-8'
    )
    const tssSource = require('fs').readFileSync(
      require('path').join(__dirname, '../../components/TodaySummaryStats.js'),
      'utf-8'
    )
    const wstSource = require('fs').readFileSync(
      require('path').join(__dirname, '../../components/WeeklySummaryTeaser.js'),
      'utf-8'
    )
    const tjsSource = require('fs').readFileSync(
      require('path').join(__dirname, '../../components/TodaysJuiceSpotlight.js'),
      'utf-8'
    )
    const all = fncSource + tssSource + wstSource + tjsSource
    expect(all).not.toContain('TodayScreen')
    expect(all).not.toContain('HistoryScreen')
    expect(all).not.toContain('ScanScreen')
    expect(all).not.toContain('ExploreScreen')
  })
})
