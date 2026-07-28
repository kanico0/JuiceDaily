/* eslint-env jest, node */

const fs = require('fs')
const path = require('path')

const noviceJourneyPath = path.join(__dirname, '..', 'NoviceJourneyScreen.js')
const educationStorePath = path.join(__dirname, '..', '..', 'services', 'EducationStore.js')
const educationContentPath = path.join(__dirname, '..', '..', 'constants', 'educationContent.js')
const safetyFooterPath = path.join(__dirname, '..', '..', 'components', 'SafetyFooter.js')
const trafficLightBadgePath = path.join(__dirname, '..', '..', 'components', 'TrafficLightBadge.js')

function read(file) {
  return fs.readFileSync(file, 'utf8')
}

describe('Onboarding read-status removal', () => {
  test('NoviceJourneyScreen does not contain Mark as Read button', () => {
    const source = read(noviceJourneyPath)
    expect(source).not.toContain('Mark as Read')
    expect(source).not.toContain('handleMarkRead')
  })

  test('NoviceJourneyScreen does not contain Completed tag or read badge', () => {
    const source = read(noviceJourneyPath)
    expect(source).not.toContain('Completed')
    expect(source).not.toContain('doneTag')
    expect(source).not.toContain('markBtn')
  })

  test('NoviceJourneyScreen does not contain lock icons or locked styles', () => {
    const source = read(noviceJourneyPath)
    expect(source).not.toContain('Lock')
    expect(source).not.toContain('itemLocked')
    expect(source).not.toContain('titleLocked')
  })

  test('NoviceJourneyScreen does not display XP badge or progress bar', () => {
    const source = read(noviceJourneyPath)
    expect(source).not.toContain('knowledgeXP')
    expect(source).not.toContain('journeyProgress')
    expect(source).not.toContain('progWrap')
    expect(source).not.toContain('progFill')
    expect(source).not.toContain('xpBadge')
    expect(source).not.toContain('TOTAL_JOURNEY_XP')
  })

  test('NoviceJourneyScreen does not contain BadgeUnlock component', () => {
    const source = read(noviceJourneyPath)
    expect(source).not.toContain('BadgeUnlock')
    expect(source).not.toContain('BEGINNER_BADGE')
  })

  test('NoviceJourneyScreen does not reference completeScreen or isScreenCompleted', () => {
    const source = read(noviceJourneyPath)
    expect(source).not.toContain('completeScreen')
    expect(source).not.toContain('isScreenCompleted')
    expect(source).not.toContain('isScreenUnlocked')
    expect(source).not.toContain('journeyComplete')
  })

  test('NoviceJourneyScreen preserves lesson content and navigation', () => {
    const source = read(noviceJourneyPath)
    expect(source).toContain('NOVICE_SCREENS')
    expect(source).toContain('handleNext')
    expect(source).toContain('handleBack')
    expect(source).toContain('handlePress')
    expect(source).toContain('All Lessons')
    expect(source).toContain('Next')
    expect(source).toContain('Finish')
    expect(source).toContain('SafetyFooter')
  })

  test('NoviceJourneyScreen still uses useEducation for metrics', () => {
    const source = read(noviceJourneyPath)
    expect(source).toContain('useEducation')
    expect(source).toContain('education.metrics')
  })

  test('NoviceJourneyScreen does not import CheckCircle or Sparkles', () => {
    const source = read(noviceJourneyPath)
    expect(source).not.toContain('CheckCircle')
    expect(source).not.toContain('Sparkles')
  })

  test('EducationStore does not contain read-status state', () => {
    const source = read(educationStorePath)
    expect(source).not.toContain('completedScreens')
    expect(source).not.toContain('highestUnlocked')
    expect(source).not.toContain('knowledgeXP')
    expect(source).not.toContain('earnedBadges')
    expect(source).not.toContain('rebootRecipesUnlocked')
  })

  test('EducationStore does not contain COMPLETE_SCREEN reducer', () => {
    const source = read(educationStorePath)
    expect(source).not.toContain('COMPLETE_SCREEN')
    expect(source).not.toContain('completeScreen')
  })

  test('EducationStore does not contain read-status derived values', () => {
    const source = read(educationStorePath)
    expect(source).not.toContain('isScreenUnlocked')
    expect(source).not.toContain('isScreenCompleted')
    expect(source).not.toContain('journeyComplete')
    expect(source).not.toContain('journeyProgress')
  })

  test('EducationStore does not import educationContent read-status constants', () => {
    const source = read(educationStorePath)
    expect(source).not.toContain('NOVICE_SCREENS')
    expect(source).not.toContain('XP_PER_SCREEN')
    expect(source).not.toContain('TOTAL_JOURNEY_XP')
    expect(source).not.toContain('BEGINNER_BADGE')
  })

  test('EducationStore preserves metrics and safety acknowledgement', () => {
    const source = read(educationStorePath)
    expect(source).toContain('INCREMENT_METRIC')
    expect(source).toContain('ACKNOWLEDGE_SAFETY')
    expect(source).toContain('incrementMetric')
    expect(source).toContain('acknowledgeSafety')
    expect(source).toContain('metrics')
    expect(source).toContain('safetyAcknowledged')
  })

  test('EducationStore preserves AsyncStorage persistence', () => {
    const source = read(educationStorePath)
    expect(source).toContain('STORAGE_KEY')
    expect(source).toContain('AsyncStorage.setItem')
    expect(source).toContain('AsyncStorage.getItem')
  })

  test('educationContent.js is not deleted (content remains accessible)', () => {
    const source = read(educationContentPath)
    expect(source).toContain('NOVICE_SCREENS')
    expect(source).toContain('SAFETY_FOOTER')
    expect(source).toContain('getTrafficLight')
  })

  test('SafetyFooter component remains intact', () => {
    const source = read(safetyFooterPath)
    expect(source).toContain('SAFETY_FOOTER')
  })

  test('TrafficLightBadge component remains intact', () => {
    const source = read(trafficLightBadgePath)
    expect(source).toContain('getTrafficLight')
  })
})
