import { getAdvancedBlendModalContent } from '../../components/AdvancedBlendModal'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
  clear: jest.fn(),
}))
jest.mock('../../services/supabase/supabaseClient', () => ({
  supabase: { auth: { getSession: jest.fn(), signInAnonymously: jest.fn() } },
}))
jest.mock('../../services/supabase/identity', () => ({
  getAccessToken: jest.fn(),
}))

describe('getAdvancedBlendModalContent', () => {
  describe('fifth_ingredient_notice stage', () => {
    it('returns title "This is an Advanced Blend"', () => {
      const content = getAdvancedBlendModalContent('fifth_ingredient_notice', 3)
      expect(content.title).toBe('This is an Advanced Blend')
    })

    it('mentions 5 or more ingredients', () => {
      const content = getAdvancedBlendModalContent('fifth_ingredient_notice', 3)
      expect(content.body).toContain('5 or more ingredients')
    })

    it('mentions 3 lifetime analyses', () => {
      const content = getAdvancedBlendModalContent('fifth_ingredient_notice', 3)
      expect(content.body).toContain('3 lifetime Advanced Blend analyses')
    })

    it('clarifies allowance only used after successful analysis', () => {
      const content = getAdvancedBlendModalContent('fifth_ingredient_notice', 3)
      expect(content.body).toContain('only used after the analysis completes successfully')
    })

    it('has no subtitle', () => {
      const content = getAdvancedBlendModalContent('fifth_ingredient_notice', 3)
      expect(content.subtitle).toBeNull()
    })
  })

  describe('pre_analysis_confirmation stage', () => {
    it('returns title "Use an Advanced Blend analysis?"', () => {
      const content = getAdvancedBlendModalContent('pre_analysis_confirmation', 2)
      expect(content.title).toBe('Use an Advanced Blend analysis?')
    })

    it('shows remaining count in body', () => {
      const content = getAdvancedBlendModalContent('pre_analysis_confirmation', 2)
      expect(content.body).toContain('2')
      expect(content.body).toContain('analyses remaining')
    })

    it('shows remaining count of 1', () => {
      const content = getAdvancedBlendModalContent('pre_analysis_confirmation', 1)
      expect(content.body).toContain('1')
      expect(content.body).toContain('analysis remaining')
    })
  })

  describe('completion_confirmation stage', () => {
    it('returns title "Advanced Blend analyzed"', () => {
      const content = getAdvancedBlendModalContent('completion_confirmation', 2)
      expect(content.title).toBe('Advanced Blend analyzed')
    })

    it('shows remaining count in body', () => {
      const content = getAdvancedBlendModalContent('completion_confirmation', 2)
      expect(content.body).toContain('2')
      expect(content.body).toContain('analyses remaining')
    })

    it('does not use alarming language', () => {
      const content = getAdvancedBlendModalContent('completion_confirmation', 0)
      expect(content.body.toLowerCase()).not.toContain('warning')
      expect(content.body.toLowerCase()).not.toContain('limit')
      expect(content.body.toLowerCase()).not.toContain('exceeded')
    })
  })

  describe('allowance_exhausted stage', () => {
    it('tells user they have used all 3 complimentary blends', () => {
      const content = getAdvancedBlendModalContent('allowance_exhausted', 0)
      expect(content.body).toContain('3 complimentary')
    })

    it('mentions unlimited Advanced Blends with Pro', () => {
      const content = getAdvancedBlendModalContent('allowance_exhausted', 0)
      expect(content.body).toContain('unlimited Advanced Blend')
    })

    it('mentions Simple Blends are still free', () => {
      const content = getAdvancedBlendModalContent('allowance_exhausted', 0)
      expect(content.body).toContain('Simple Blends')
    })

    it('mentions manual logging is free', () => {
      const content = getAdvancedBlendModalContent('allowance_exhausted', 0)
      expect(content.body).toContain('manual logging')
    })
  })

  describe('network_retry stage', () => {
    it('returns title about connection needed', () => {
      const content = getAdvancedBlendModalContent('network_retry', 0)
      expect(content.title).toContain('Connection')
    })

    it('mentions checking internet connection', () => {
      const content = getAdvancedBlendModalContent('network_retry', 0)
      expect(content.body).toContain('internet connection')
    })

    it('mentions ingredients are saved', () => {
      const content = getAdvancedBlendModalContent('network_retry', 0)
      expect(content.body).toContain('saved')
    })

    it('mentions no allowance has been used', () => {
      const content = getAdvancedBlendModalContent('network_retry', 0)
      expect(content.body).toContain('No allowance')
    })
  })
})

// ── Regression: Premature dismissal of completion message ──────

describe('AdvancedBlendModal — completion premature dismissal regression', () => {
  const fs = require('fs')
  const path = require('path')
  const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'AdvancedBlendModal.js'), 'utf8')

  test('1. allowBackdropDismiss flag exists and is gated by isCompletion', () => {
    expect(SOURCE).toMatch(/allowBackdropDismiss\s*=\s*!isCompletion/)
  })

  test('2. backdrop onPress is undefined when allowBackdropDismiss is false', () => {
    expect(SOURCE).toMatch(/onPress=\{allowBackdropDismiss\s*\?\s*onDismiss\s*:\s*undefined\}/)
  })

  test('3. close button is conditionally rendered with allowBackdropDismiss', () => {
    expect(SOURCE).toMatch(/\{allowBackdropDismiss\s*&&\s*\(/)
  })

  test('4. completion stage still renders an OK button for explicit dismissal', () => {
    const completionSection = SOURCE.substring(
      SOURCE.indexOf('!showConfirmButton && !showRetryButton && !showUpgradeButton'),
    )
    expect(completionSection).toContain('OK')
    expect(completionSection).toContain('onDismiss')
  })

  test('5. isCompletion flag is derived from completion_confirmation stage', () => {
    expect(SOURCE).toMatch(/isCompletion\s*=\s*stage\s*===\s*['"]completion_confirmation['"]/)
  })

  test('6. non-completion stages still allow backdrop dismissal', () => {
    const backdropIdx = SOURCE.indexOf('allowBackdropDismiss ? onDismiss : undefined')
    expect(backdropIdx).toBeGreaterThan(-1)
  })
})

// ── Regression: HomeScreen resetLoggedOnFocus preserves completion modal ──

describe('HomeScreen — resetLoggedOnFocus does not dismiss completion_confirmation', () => {
  const fs = require('fs')
  const path = require('path')
  const HOME_SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'screens', 'HomeScreen.js'),
    'utf8',
  )

  test('1. resetLoggedOnFocus guards setShowAdvancedBlendModal with completion_confirmation check', () => {
    const focusMatch = HOME_SRC.match(/const resetLoggedOnFocus = \(\) => \{([\s\S]*?)\n    \}/)
    expect(focusMatch).toBeTruthy()
    const body = focusMatch[1]
    expect(body).toContain('completion_confirmation')
    expect(body).toContain('advancedBlendStageRef.current')
    expect(body).toMatch(/advancedBlendStageRef\.current\s*!==\s*['"]completion_confirmation['"]/)
  })

  test('2. advancedBlendStageRef is kept in sync with advancedBlendStage state', () => {
    expect(HOME_SRC).toMatch(/advancedBlendStageRef\.current\s*=\s*advancedBlendStage/)
  })

  test('3. non-completion stages still get setShowAdvancedBlendModal(false) on focus', () => {
    const focusMatch = HOME_SRC.match(/const resetLoggedOnFocus = \(\) => \{([\s\S]*?)\n    \}/)
    expect(focusMatch).toBeTruthy()
    const body = focusMatch[1]
    expect(body).toContain('setShowAdvancedBlendModal(false)')
  })
})
