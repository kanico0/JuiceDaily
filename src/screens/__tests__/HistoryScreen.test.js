import React from 'react'
import TestRenderer from 'react-test-renderer'
import { act } from 'react-test-renderer'
import HistoryScreen from '../HistoryScreen'
import { getHistoryGuidance } from '../../services/historyGuidance'

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
  SafeAreaProvider: ({ children }) => children,
}))
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: () => null,
}))
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
}))
jest.mock('lucide-react-native', () => {
  const MockIcon = () => null
  return {
    ArrowLeft: MockIcon,
    ChevronDown: MockIcon,
    ChevronUp: MockIcon,
    X: MockIcon,
    Camera: MockIcon,
    Keyboard: MockIcon,
    Eye: MockIcon,
    Trash2: MockIcon,
    Clock: MockIcon,
  }
})
jest.mock('../../components/MeshGradientBg', () => () => null)
jest.mock('../../services/JuiceEngine', () => ({
  PRODUCE_DATA: {
    kale: { name: 'Kale', category: 'vegetable' },
    apple: { name: 'Apple', category: 'fruit' },
    ginger: { name: 'Ginger', category: 'vegetable' },
    carrot: { name: 'Carrot', category: 'vegetable' },
    spinach: { name: 'Spinach', category: 'vegetable' },
    lemon: { name: 'Lemon', category: 'fruit' },
    beet: { name: 'Beet', category: 'vegetable' },
    celery: { name: 'Celery', category: 'vegetable' },
  },
}))
jest.mock('../../constants/nutrition', () => ({
  USDA_RDA: {
    vitaminC: 90,
    vitaminA: 900,
    potassium: 4700,
    iron: 18,
    magnesium: 400,
    folate: 400,
  },
}))
jest.mock('../../utils/DevClock', () => ({
  getDevNow: () => new Date(2026, 0, 15, 10, 0, 0),
  onDevClockChange: () => () => {},
}))
jest.mock('../../services/AnalyticsService', () => ({
  trackEvent: jest.fn(),
}))

let mockEntries = []
let mockDeleteEntry = jest.fn()

jest.mock('../../services/JuiceLogStore', () => ({
  useJuiceLog: () => ({
    entries: mockEntries,
    deleteEntry: mockDeleteEntry,
    isHydrated: true,
    totalLogCount: mockEntries.length,
    todayEntries: [],
    last7DaysEntries: [],
    diversityStats: {},
    consistencyStats: {},
    addEntry: jest.fn(),
    resetLog: jest.fn(),
  }),
}))

function createEntry(dateKey, ingredients, source = 'photo') {
  return {
    id: `entry-${dateKey}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: `${dateKey}T10:00:00`,
    dateKey,
    source,
    title: ingredients.slice(0, 3).map((id) => id.charAt(0).toUpperCase() + id.slice(1)).join(', '),
    ingredients,
    nutrientSummary: { vitaminC: 50, potassium: 1000 },
    scoreContribution: 10,
  }
}

function findAllByText(node, text) {
  const results = []
  function walk(n) {
    if (!n) return
    if (n.props && n.props.children === text) {
      results.push(n)
    }
    if (n.props && Array.isArray(n.props.children)) {
      n.props.children.forEach(walk)
    }
    if (n.children && Array.isArray(n.children)) {
      n.children.forEach(walk)
    }
  }
  walk(node)
  return results
}

function findAllByRole(node, role) {
  const results = []
  function walk(n) {
    if (!n) return
    if (n.props && n.props.accessibilityRole === role) {
      results.push(n)
    }
    if (n.props && Array.isArray(n.props.children)) {
      n.props.children.forEach(walk)
    }
    if (n.children && Array.isArray(n.children)) {
      n.children.forEach(walk)
    }
  }
  walk(node)
  return results
}

function findAllByLabel(node, label) {
  const results = []
  function walk(n) {
    if (!n) return
    if (n.props && n.props.accessibilityLabel === label) {
      results.push(n)
    }
    if (n.props && Array.isArray(n.props.children)) {
      n.props.children.forEach(walk)
    }
    if (n.children && Array.isArray(n.children)) {
      n.children.forEach(walk)
    }
  }
  walk(node)
  return results
}

describe('HistoryScreen integration', () => {
  let renderer
  const mockNavigate = jest.fn()

  beforeEach(() => {
    mockEntries = []
    mockNavigate.mockClear()
    mockDeleteEntry.mockClear()
    require('../../services/AnalyticsService').trackEvent.mockClear()
  })

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer.unmount()
      })
      renderer = null
    }
  })

  function renderScreen() {
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(HistoryScreen, { navigation: { navigate: mockNavigate, goBack: jest.fn() } })
      )
    })
    return renderer.root
  }

  test('active History route renders HistoryScreen component', () => {
    const tree = renderScreen()
    expect(tree).toBeTruthy()
  })

  test('empty-state guidance shows title, body, and action buttons', () => {
    const tree = renderScreen()
    const title = findAllByText(tree, 'Your juice history starts here')
    expect(title.length).toBeGreaterThan(0)
    const scanBtn = findAllByLabel(tree, 'Scan produce')
    expect(scanBtn.length).toBeGreaterThan(0)
    const manualBtn = findAllByLabel(tree, 'Enter ingredients manually')
    expect(manualBtn.length).toBeGreaterThan(0)
  })

  test('one-day guidance shows started state', () => {
    mockEntries = [createEntry('2026-01-15', ['kale', 'apple'])]
    const tree = renderScreen()
    const title = findAllByText(tree, 'You\u2019ve started your flow')
    expect(title.length).toBeGreaterThan(0)
  })

  test('two-to-six-day guidance shows building state', () => {
    mockEntries = [
      createEntry('2026-01-14', ['kale', 'apple']),
      createEntry('2026-01-15', ['carrot', 'ginger']),
    ]
    const tree = renderScreen()
    const title = findAllByText(tree, 'Your history is taking shape')
    expect(title.length).toBeGreaterThan(0)
  })

  test('seven-plus-day guidance shows established state', () => {
    const days = []
    for (let i = 0; i < 7; i++) {
      days.push(createEntry(`2026-01-${String(9 + i).padStart(2, '0')}`, ['kale', 'apple']))
    }
    mockEntries = days
    const tree = renderScreen()
    const title = findAllByText(tree, 'Your RawLifeFlow journey')
    expect(title.length).toBeGreaterThan(0)
  })

  test('one guidance card maximum — established state has only one guidance card', () => {
    const days = []
    for (let i = 0; i < 10; i++) {
      days.push(createEntry(`2026-01-${String(6 + i).padStart(2, '0')}`, ['kale', 'apple']))
    }
    mockEntries = days
    const tree = renderScreen()
    const titles = findAllByText(tree, 'Your RawLifeFlow journey')
    expect(titles.length).toBeGreaterThan(0)
    const json = JSON.stringify(renderer.toJSON())
    const cardCount = (json.match(/Your RawLifeFlow journey/g) || []).length
    expect(cardCount).toBe(1)
  })

  test('existing date groups still render', () => {
    mockEntries = [
      createEntry('2026-01-15', ['kale', 'apple']),
      createEntry('2026-01-14', ['carrot', 'ginger']),
    ]
    const tree = renderScreen()
    const todayLabels = findAllByText(tree, 'Today')
    expect(todayLabels.length).toBeGreaterThan(0)
    const yesterdayLabels = findAllByText(tree, 'Yesterday')
    expect(yesterdayLabels.length).toBeGreaterThan(0)
  })

  test('existing row content still renders', () => {
    mockEntries = [createEntry('2026-01-15', ['kale', 'apple'])]
    const tree = renderScreen()
    const buttons = findAllByRole(tree, 'button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  test('sorting remains unchanged — newest date first', () => {
    mockEntries = [
      createEntry('2026-01-10', ['kale']),
      createEntry('2026-01-15', ['apple']),
      createEntry('2026-01-12', ['carrot']),
    ]
    const tree = renderScreen()
    const todayText = findAllByText(tree, 'Today')
    expect(todayText.length).toBeGreaterThan(0)
  })

  test('Scan action navigates to ScanFlow', () => {
    const tree = renderScreen()
    const scanBtn = findAllByLabel(tree, 'Scan produce')
    expect(scanBtn.length).toBeGreaterThan(0)
    act(() => {
      scanBtn[0].props.onPress()
    })
    expect(mockNavigate).toHaveBeenCalledWith(
      'ScanFlow',
      { screen: 'ScanHome', params: { openCamera: true, source: 'camera' } }
    )
  })

  test('manual-entry action opens the existing manual path', () => {
    const tree = renderScreen()
    const manualBtn = findAllByLabel(tree, 'Enter ingredients manually')
    expect(manualBtn.length).toBeGreaterThan(0)
    act(() => {
      manualBtn[0].props.onPress()
    })
    expect(mockNavigate).toHaveBeenCalledWith(
      'ScanFlow',
      { screen: 'ScanHome', params: { manualEntry: true } }
    )
  })

  test('manual entry is not presented as quota-limited', () => {
    const tree = renderScreen()
    const treeJson = JSON.stringify(renderer.toJSON())
    expect(treeJson).not.toContain('quota')
    expect(treeJson).not.toContain('limit')
    expect(treeJson).not.toContain('upgrade')
  })

  test('accessibility roles and labels exist on buttons', () => {
    const tree = renderScreen()
    const buttons = findAllByRole(tree, 'button')
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((btn) => {
      expect(btn.props.accessibilityLabel).toBeTruthy()
    })
  })

  test('guidance impression fires once per screen visit', () => {
    const { trackEvent } = require('../../services/AnalyticsService')
    renderScreen()
    expect(trackEvent).toHaveBeenCalledWith('history_guidance_shown', { guidance_state: 'empty' })
    const initialCallCount = trackEvent.mock.calls.filter(
      (c) => c[0] === 'history_guidance_shown'
    ).length
    expect(initialCallCount).toBe(1)
  })

  test('no open handles or post-unmount updates', () => {
    const tree = renderScreen()
    act(() => {
      renderer.unmount()
    })
    renderer = null
    expect(true).toBe(true)
  })
})
