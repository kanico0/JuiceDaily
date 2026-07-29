// Disclaimer copy integrity test: verifies that all four disclaimer surfaces
// use the exact intended copy from Docs/disclaimer_copy.md.

import * as fs from 'fs'
import * as path from 'path'

describe('Disclaimer copy integrity', () => {
  const disclaimerPath = path.join(__dirname, '..', '..', '..', 'Docs', 'disclaimer_copy.md')
  const componentPath = path.join(__dirname, '..', '..', 'components', 'WellnessDisclaimer.js')
  const focusScreenPath = path.join(__dirname, '..', '..', 'screens', 'WellnessFocusScreen.js')
  const resultsScreenPath = path.join(__dirname, '..', '..', 'screens', 'WellnessResultsScreen.js')

  const mdContent = fs.readFileSync(disclaimerPath, 'utf-8')
  const componentSource = fs.readFileSync(componentPath, 'utf-8')

  describe('1. First-use modal', () => {
    it('uses exact title from disclaimer_copy.md', () => {
      expect(componentSource).toContain('Before you explore')
    })

    it('uses exact body text from disclaimer_copy.md', () => {
      expect(componentSource).toContain('This tool suggests juices based on nutrients that are commonly discussed')
      expect(componentSource).toContain('online for general wellness topics')
      expect(componentSource).toContain("it\\'s for education and entertainment")
      expect(componentSource).toContain('not medical advice')
      expect(componentSource).toContain("It doesn\\'t diagnose, treat, or replace guidance from a")
      expect(componentSource).toContain('doctor or registered dietitian')
      expect(componentSource).toContain('If you have a persistent symptom or a')
      expect(componentSource).toContain('diagnosed condition, please check with a healthcare professional before')
      expect(componentSource).toContain('changing your diet')
    })

    it('uses exact button text from disclaimer_copy.md', () => {
      expect(componentSource).toContain('Got it, show me juices')
    })
  })

  describe('2. Persistent banner', () => {
    it('uses exact banner text from disclaimer_copy.md', () => {
      expect(componentSource).toContain('For education & entertainment only — not medical advice.')
    })

    it('uses exact Learn More link text', () => {
      expect(componentSource).toContain('Learn more')
    })

    it('uses orange heart emoji (not red heart)', () => {
      expect(componentSource).toContain('\\u{1F9E1}')
      expect(componentSource).not.toContain('\\u2764')
    })
  })

  describe('3. Micro-disclaimer', () => {
    it('uses exact micro-disclaimer text from disclaimer_copy.md', () => {
      expect(componentSource).toContain(
        'Nutrient info is general, not personalized. Not a substitute for medical advice.'
      )
    })
  })

  describe('4. Settings / About full version', () => {
    it('uses exact title from disclaimer_copy.md', () => {
      expect(componentSource).toContain('Wellness Lookup Disclaimer')
    })

    it('uses exact body text from disclaimer_copy.md', () => {
      expect(componentSource).toContain('The Wellness Lookup feature suggests juices based on vitamins, minerals')
      expect(componentSource).toContain('and plant compounds that are commonly associated online with general')
      expect(componentSource).toContain('wellness topics (e.g. joint comfort, immune support, energy levels)')
      expect(componentSource).toContain('These associations are drawn from generally available public nutrition')
      expect(componentSource).toContain('information and are provided for educational and entertainment purposes')
      expect(componentSource).toContain('only')
      expect(componentSource).toContain('This feature is not a medical device, does not diagnose or treat any')
      expect(componentSource).toContain('condition, and is not a substitute for professional medical advice')
      expect(componentSource).toContain('diagnosis, or treatment. Individual nutritional needs vary. Always consult')
      expect(componentSource).toContain('a doctor, registered dietitian, or other qualified health provider before')
      expect(componentSource).toContain('making dietary changes — especially if you are pregnant or nursing, take')
      expect(componentSource).toContain('medication, or manage a diagnosed medical condition')
    })
  })

  describe('Micro-disclaimer placement', () => {
    it('appears in WellnessResultsScreen (recipe cards)', () => {
      const resultsSource = fs.readFileSync(resultsScreenPath, 'utf-8')
      expect(resultsSource).toContain('WellnessMicroDisclaimer')
    })

    it('does NOT appear in WellnessFocusScreen (topic list)', () => {
      const focusSource = fs.readFileSync(focusScreenPath, 'utf-8')
      expect(focusSource).not.toContain('WellnessMicroDisclaimer')
    })
  })

  describe('First-use modal placement', () => {
    it('does NOT appear in WellnessFocusScreen', () => {
      const focusSource = fs.readFileSync(focusScreenPath, 'utf-8')
      expect(focusSource).not.toContain('WellnessDisclaimerModal')
    })

    it('appears in WellnessResultsScreen', () => {
      const resultsSource = fs.readFileSync(resultsScreenPath, 'utf-8')
      expect(resultsSource).toContain('WellnessDisclaimerModal')
      expect(resultsSource).toContain('useWellnessDisclaimerAccepted')
    })
  })
})
