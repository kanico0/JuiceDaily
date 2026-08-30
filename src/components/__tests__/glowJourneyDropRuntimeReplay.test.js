// ─────────────────────────────────────────────────────────────
// glowJourneyDropRuntimeReplay.test.js — Real component-level
// (not source-pattern) tests for GlowJourneyDrop's entrance replay.
//
// Physical QA on commit 5863859 found that entering Explore produced
// a blank screen. The actual crash site (BrowseHome/ScanScreen scope
// bug) cannot be runtime-mounted economically here — ScanScreen is a
// ~3000-line screen with a large native/service dependency surface,
// and this project's established convention (see
// livingGardenSceneMount.test.js) is to avoid mounting such
// SVG/native-heavy screens directly in unit tests. That specific
// scope relationship is instead covered by AST-boundary tests in
// gardenGlowReplayRegression.test.js (tests 63-66).
//
// This file complements those source tests with REAL runtime
// rendering (react-test-renderer) of GlowJourneyDrop itself — the
// component whose entrance-replay logic was modified — using the
// same react-native-svg mock pattern already established in
// __tests__/TodayIntegration.test.js. It proves:
//
//   1. GlowJourneyDrop renders without throwing on mount, and its
//      content (not a blank tree) is present.
//   2. It renders without throwing across replayToken increments
//      (repeated intentional Explore entries) while remaining
//      mounted, and content remains present after each replay
//      (never crashes into a blank/empty tree).
//   3. It renders without throwing across full unmount/remount
//      cycles (covers a parent conditionally unmounting it, e.g.
//      an obStep toggle).
//   4. Persisted Glow props (streakCount, weeklyQualifyingDays,
//      etc.) passed to the component are never mutated by replay.
//   5. Reduce Motion path renders without throwing.
// ─────────────────────────────────────────────────────────────

const React = require('react')
const TestRenderer = require('react-test-renderer')
const { act } = TestRenderer

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
}))

jest.mock('react-native-svg', () => {
  const ReactLocal = require('react')
  const RN = require('react-native')
  const Mock = ReactLocal.forwardRef((props, ref) =>
    ReactLocal.createElement(RN.View, { ...props, ref }, props.children),
  )
  return {
    __esModule: true,
    default: Mock,
    Svg: Mock,
    Defs: Mock,
    ClipPath: Mock,
    Path: Mock,
    RadialGradient: Mock,
    LinearGradient: Mock,
    Stop: Mock,
    G: Mock,
    Rect: Mock,
    Circle: Mock,
    Ellipse: Mock,
    Line: Mock,
    Text: Mock,
  }
})

const RN = require('react-native')
const { Text, AccessibilityInfo } = RN

// Avoid the async AccessibilityInfo.isReduceMotionEnabled() promise
// (from useReducedMotion) causing unhandled errors/act() warnings
// when isReduced is passed explicitly as a prop in every test below.
// Stub the specific methods on the already-preset-mocked module
// rather than replacing the whole 'react-native' module (which would
// bypass jest-expo's native-module mocking pipeline).
jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() })

const GlowJourneyDrop = require('../GlowJourneyDrop').default

const baseProps = {
  streakCount: 3,
  entries: [],
  lifetimeDays: 12,
  weeklyQualifyingDays: 2,
  weeklyLeafStates: [
    { hasLog: true },
    { hasLog: true },
    { hasLog: false },
    { hasLog: false },
    { hasLog: false },
    { hasLog: false },
    { hasLog: false },
  ],
  onPress: jest.fn(),
}

// Renders content (not blank/crashed) if the streak numeral text is
// present in the output tree.
function hasRenderedContent(root) {
  const textNodes = root.findAllByType(Text)
  return textNodes.some((t) => {
    const children = Array.isArray(t.props.children) ? t.props.children : [t.props.children]
    return children.some((c) => String(c) === String(baseProps.streakCount))
  })
}

describe('GlowJourneyDrop runtime replay — real component render', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  test('1. Renders without throwing on initial mount, with content present (not blank)', () => {
    let root
    expect(() => {
      act(() => {
        root = TestRenderer.create(
          React.createElement(GlowJourneyDrop, { ...baseProps, isReduced: false, replayToken: 0 }),
        )
      })
    }).not.toThrow()
    expect(root).toBeTruthy()
    expect(hasRenderedContent(root.root)).toBe(true)
  })

  test('2. Renders without throwing across repeated replayToken increments, content stays present (never blank)', () => {
    let root
    act(() => {
      root = TestRenderer.create(
        React.createElement(GlowJourneyDrop, { ...baseProps, isReduced: false, replayToken: 0 }),
      )
    })
    act(() => { jest.advanceTimersByTime(500) })
    expect(hasRenderedContent(root.root)).toBe(true)

    for (let token = 1; token <= 3; token++) {
      expect(() => {
        act(() => {
          root.update(
            React.createElement(GlowJourneyDrop, { ...baseProps, isReduced: false, replayToken: token }),
          )
        })
        act(() => { jest.advanceTimersByTime(500) })
      }).not.toThrow()
      // After each intentional replay, content must still be present —
      // this is the literal "blank screen" failure mode physical QA
      // reported (a crash/exception unmounts the tree entirely).
      expect(hasRenderedContent(root.root)).toBe(true)
    }
  })

  test('3. Renders without throwing across a full unmount + remount cycle, and content is present after remount', () => {
    let root
    act(() => {
      root = TestRenderer.create(
        React.createElement(GlowJourneyDrop, { ...baseProps, isReduced: false, replayToken: 0 }),
      )
    })
    act(() => { jest.advanceTimersByTime(500) })

    expect(() => {
      act(() => { root.unmount() })
    }).not.toThrow()

    let remounted
    expect(() => {
      act(() => {
        remounted = TestRenderer.create(
          React.createElement(GlowJourneyDrop, { ...baseProps, isReduced: false, replayToken: 0 }),
        )
      })
      act(() => { jest.advanceTimersByTime(500) })
    }).not.toThrow()

    expect(hasRenderedContent(remounted.root)).toBe(true)
  })

  test('4. Persisted Glow props are never mutated across replay', () => {
    const props = { ...baseProps, isReduced: false, replayToken: 0 }
    const frozenWeeklyLeafStates = JSON.parse(JSON.stringify(props.weeklyLeafStates))
    let root
    act(() => {
      root = TestRenderer.create(React.createElement(GlowJourneyDrop, props))
    })
    act(() => { jest.advanceTimersByTime(500) })
    act(() => {
      root.update(React.createElement(GlowJourneyDrop, { ...props, replayToken: 1 }))
    })
    act(() => { jest.advanceTimersByTime(500) })

    // The props object passed in must not have been mutated.
    expect(props.streakCount).toBe(baseProps.streakCount)
    expect(props.lifetimeDays).toBe(baseProps.lifetimeDays)
    expect(props.weeklyQualifyingDays).toBe(baseProps.weeklyQualifyingDays)
    expect(props.weeklyLeafStates).toEqual(frozenWeeklyLeafStates)
  })

  test('5. Reduce Motion renders without throwing, with content present', () => {
    let root
    expect(() => {
      act(() => {
        root = TestRenderer.create(
          React.createElement(GlowJourneyDrop, { ...baseProps, isReduced: true, replayToken: 0 }),
        )
      })
    }).not.toThrow()
    expect(hasRenderedContent(root.root)).toBe(true)
  })

  test('6. Reduce Motion renders without throwing across replayToken increments', () => {
    let root
    act(() => {
      root = TestRenderer.create(
        React.createElement(GlowJourneyDrop, { ...baseProps, isReduced: true, replayToken: 0 }),
      )
    })
    expect(() => {
      act(() => {
        root.update(
          React.createElement(GlowJourneyDrop, { ...baseProps, isReduced: true, replayToken: 1 }),
        )
      })
    }).not.toThrow()
    expect(hasRenderedContent(root.root)).toBe(true)
  })
})
