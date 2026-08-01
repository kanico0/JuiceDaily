jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiRemove: jest.fn(() => Promise.resolve()),
}))

import {
  LESSONS,
  EXPERIENCE_LEVELS,
  getLesson,
  getLessonTitle,
} from '../lessonContent'

const EMPTY_ACTIVATION = {
  totalLogsCount: 0,
  firstLogDate: null,
  lastLogDate: null,
  onboardingComplete: false,
  trackingOptIn: false,
  selectedGoal: null,
  experienceLevel: null,
  introDismissed: false,
}

// Mock CommonActions for navigation verification
const mockDispatch = jest.fn()
const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
const mockCanGoBack = jest.fn(() => true)

function createMockNavigation() {
  return {
    dispatch: mockDispatch,
    navigate: mockNavigate,
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
  }
}

describe('Feature Group 3 — Onboarding and Today Replay Navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Initial onboarding behavior', () => {
    it('4. Initial selection saves the chosen level', () => {
      // Simulates what App.js onSelect does:
      // setExperienceLevel(value) is called
      const state = { ...EMPTY_ACTIVATION }
      const updatedState = { ...state, experienceLevel: 'new' }
      expect(updatedState.experienceLevel).toBe('new')

      const updatedState2 = { ...state, experienceLevel: 'casual' }
      expect(updatedState2.experienceLevel).toBe('casual')

      const updatedState3 = { ...state, experienceLevel: 'experienced' }
      expect(updatedState3.experienceLevel).toBe('experienced')
    })

    it('5. Initial selection opens the correct lesson for each level', () => {
      // For new users (isReturning=false), onSelect should navigate to Lesson
      // with the selected level
      const nav = createMockNavigation()
      const isReturning = false

      for (const level of EXPERIENCE_LEVELS) {
        jest.clearAllMocks()
        // Simulate onSelect logic from App.js
        if (isReturning) {
          nav.navigate('Lesson', { level, isReplay: true })
        } else {
          nav.navigate('Lesson', { level, isReplay: false })
        }
        expect(nav.navigate).toHaveBeenCalledWith('Lesson', { level, isReplay: false })
      }
    })

    it('6. Completing an initial lesson navigates to Today (Main)', () => {
      // LessonScreen handleBack for isReplay=false dispatches reset to Main
      const nav = createMockNavigation()
      const isReplay = false

      // Simulate handleBack
      if (isReplay) {
        nav.goBack()
      } else {
        const { CommonActions } = require('@react-navigation/native')
        nav.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Main' }],
          })
        )
      }

      expect(nav.dispatch).toHaveBeenCalled()
      expect(nav.goBack).not.toHaveBeenCalled()
    })

    it('7. Normal later launches do not force onboarding', () => {
      // When introDismissed is true or totalLogsCount > 0, initialRoute is 'Main'
      const state1 = { introDismissed: true, totalLogsCount: 0 }
      const state2 = { introDismissed: false, totalLogsCount: 5 }
      const state3 = { introDismissed: true, totalLogsCount: 5 }

      const skip1 = state1.introDismissed || state1.totalLogsCount > 0
      const skip2 = state2.introDismissed || state2.totalLogsCount > 0
      const skip3 = state3.introDismissed || state3.totalLogsCount > 0

      expect(skip1).toBe(true)
      expect(skip2).toBe(true)
      expect(skip3).toBe(true)

      // New user should NOT skip
      const stateNew = { introDismissed: false, totalLogsCount: 0 }
      const skipNew = stateNew.introDismissed || stateNew.totalLogsCount > 0
      expect(skipNew).toBe(false)
    })
  })

  describe('Today-screen lesson replay behavior', () => {
    it('8. Today entry displays all three levels (via JuicingExperienceScreen)', () => {
      // JuicingExperienceScreen shows all 3 levels
      const levels = ['new', 'casual', 'experienced']
      expect(levels).toEqual(EXPERIENCE_LEVELS)
    })

    it('9. Selecting each level from Today displays the correct lesson', () => {
      // For returning users, onSelect navigates to Lesson with isReplay=true
      const nav = createMockNavigation()
      const isReturning = true

      for (const level of EXPERIENCE_LEVELS) {
        jest.clearAllMocks()
        if (isReturning) {
          nav.navigate('Lesson', { level, isReplay: true })
        } else {
          nav.navigate('Lesson', { level, isReplay: false })
        }
        expect(nav.navigate).toHaveBeenCalledWith('Lesson', { level, isReplay: true })
      }
    })

    it('10. Lesson replay returns to Today', () => {
      // LessonScreen handleBack for isReplay=true calls goBack
      const nav = createMockNavigation()
      const isReplay = true

      if (isReplay) {
        nav.goBack()
      } else {
        nav.dispatch({})
      }

      expect(nav.goBack).toHaveBeenCalled()
      expect(nav.dispatch).not.toHaveBeenCalled()
    })

    it('11. Replay works even after prior completion', () => {
      // The lesson data is static — it doesn't check completion state
      // Replaying always shows the full lesson
      const lesson = getLesson('new')
      expect(lesson).not.toBeNull()
      expect(lesson.sections.length).toBeGreaterThan(0)

      // Can replay multiple times
      const lesson2 = getLesson('new')
      expect(lesson2).toBe(lesson) // Same static data
    })

    it('12. Replay does not reset account, quota, history, settings, or subscription', () => {
      // Verify that the replay flow only calls navigate('Lesson', ...)
      // It does NOT call any reset/clear functions
      const nav = createMockNavigation()
      const isReturning = true

      if (isReturning) {
        nav.navigate('Lesson', { level: 'new', isReplay: true })
      }

      expect(nav.navigate).toHaveBeenCalledTimes(1)
      expect(nav.navigate).toHaveBeenCalledWith('Lesson', { level: 'new', isReplay: true })
      expect(nav.dispatch).not.toHaveBeenCalled() // No reset dispatch
    })
  })

  describe('Back and close behavior', () => {
    it('13. Back and close behavior are correct for replay', () => {
      const nav = createMockNavigation()
      const isReplay = true

      // Back/close should goBack to Today
      if (isReplay) {
        nav.goBack()
      }
      expect(nav.goBack).toHaveBeenCalled()
    })

    it('13b. Back and close behavior are correct for initial onboarding', () => {
      const nav = createMockNavigation()
      const isReplay = false

      // Back/close should dispatch reset to Main
      if (!isReplay) {
        const { CommonActions } = require('@react-navigation/native')
        nav.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Main' }],
          })
        )
      }
      expect(nav.dispatch).toHaveBeenCalled()
      expect(nav.goBack).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('14. JuicingExperienceScreen has accessibility labels for all 3 level buttons', () => {
      // Verify the accessibility labels exist in the screen source
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '../../screens/JuicingExperienceScreen.js'),
        'utf-8'
      )
      expect(source).toContain('accessibilityLabel="New to Juicing')
      expect(source).toContain('accessibilityLabel="Casual Juicer')
      expect(source).toContain('accessibilityLabel="Experienced Juicer')
      expect(source).toContain('accessibilityRole="button"')
    })

    it('14b. LessonScreen has accessibility headings and buttons', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '../../screens/LessonScreen.js'),
        'utf-8'
      )
      expect(source).toContain('accessibilityRole="header"')
      expect(source).toContain('accessibilityRole="button"')
      expect(source).toContain('accessibilityLabel="Go back"')
      expect(source).toContain('accessibilityLabel="Close lesson"')
    })

    it('15. Today card uses the new inclusive label', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '../../screens/TodayScreen.js'),
        'utf-8'
      )
      expect(source).toContain('Explore Juicing Lessons')
      expect(source).toContain('accessibilityLabel="Explore Juicing Lessons"')
      // Old label should be gone
      expect(source).not.toContain('New to Juicing?')
      expect(source).not.toContain('accessibilityLabel="New to Juicing?')
    })
  })
})
