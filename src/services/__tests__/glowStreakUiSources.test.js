const fs = require('fs')
const path = require('path')

function readSource(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8')
}

describe('Glow Streak UI sources', () => {
  test('Dashboard supplies Glow Streak data to active streak surfaces', () => {
    const source = readSource('screens', 'DashboardScreen.js')

    expect(source).toContain("import { useGlowStreak } from '../services/glowStreak'")
    expect(source).toContain('const glowStreak = useGlowStreak()')
    expect(source).toContain('streak={glowStreak.count}')
    expect(source).toContain('currentStreak: glowStreak.count')
    expect(source).not.toContain("import { useStreak } from '../services/StreakEngine'")
  })

  test('ChallengeStore values are explicitly labeled as challenge progress', () => {
    const todaySource = readSource('screens', 'TodayScreen.js')
    const scanSuccessSource = readSource('screens', 'ScanSuccessScreen.js')

    expect(todaySource).toContain('Challenge Day {challenge.currentDay}')
    expect(todaySource).not.toContain('challenge.streak} day streak')
    expect(scanSuccessSource).toContain("label: 'Cycle Progress'")
    expect(scanSuccessSource).not.toContain("label: 'Streak'")
  })

  test('the disabled StreakEngine is not supplied to the active visual card', () => {
    const source = readSource('screens', 'DashboardScreen.js')

    expect(source).toContain('<StreakVisualCard')
    expect(source).not.toContain('streakData={streakCtx}')
    expect(source).not.toContain('streakCtx')
  })

  test('automatic Glow check-in happens only after save in ScanSuccessScreen, not on Yes tap in ScanScreen', () => {
    const scanSuccessSource = readSource('screens', 'ScanSuccessScreen.js')
    const scanSource = readSource('screens', 'ScanScreen.js')

    expect(scanSuccessSource).toContain('const result = await checkInToday()')
    expect(scanSuccessSource).toContain('await refreshNudges()')
    expect(scanSource).not.toContain('const result = await checkInToday()')
    expect(scanSource).not.toContain('await refreshNudges()')
  })

  test('ScanScreen no longer contains Glow Streak card UI (moved to Today in Phase 0B1)', () => {
    const scanSource = readSource('screens', 'ScanScreen.js')

    expect(scanSource).not.toContain('handleLogTodayJuice')
    expect(scanSource).not.toContain("Log today's juice to keep your Glow Streak going.")
    expect(scanSource).not.toContain("Log today's juice")
    expect(scanSource).not.toContain('handleJuicedYes')
    expect(scanSource).not.toContain('showJuicedFollowUp')
    expect(scanSource).not.toContain('Have you just juiced today?')
    expect(scanSource).not.toContain('Yes, I juiced')
  })

  test('ScanScreen does not call checkInToday directly', () => {
    const scanSource = readSource('screens', 'ScanScreen.js')

    expect(scanSource).not.toContain('const result = await checkInToday()')
    expect(scanSource).not.toContain('await refreshNudges()')
    expect(scanSource).not.toContain('import { checkInToday }')
  })

  test('ScanSuccessScreen remains the canonical check-in trigger', () => {
    const scanSuccessSource = readSource('screens', 'ScanSuccessScreen.js')

    expect(scanSuccessSource).toContain('const result = await checkInToday()')
    expect(scanSuccessSource).toContain('await refreshNudges()')
  })

  test('HomeScreen save path navigates to ScanSuccess where checkInToday fires', () => {
    const homeSource = readSource('screens', 'HomeScreen.js')

    expect(homeSource).toContain("navigation.navigate('ScanSuccess'")
    expect(homeSource).toContain('addLogEntry')
    expect(homeSource).toContain('logJuice')
  })

  test('old prompt wording is not present', () => {
    const scanSource = readSource('screens', 'ScanScreen.js')

    expect(scanSource).not.toContain('Did you juice today?')
    expect(scanSource).not.toContain('Have you just edited today?')
    expect(scanSource).not.toContain('Have you just juiced today?')
  })

  test('checked-in state message moved to TodayScreen via useGlowStreak, not on ScanScreen', () => {
    const scanSource = readSource('screens', 'ScanScreen.js')
    const todaySource = readSource('screens', 'TodayScreen.js')

    expect(scanSource).not.toContain("You're checked in for today")
    expect(todaySource).toContain('useGlowStreak')
    expect(todaySource).toContain('glowStreak.count')
  })

  test('Skip confirmation UI removed from ScanScreen in Phase 0B1 (check-in via ScanSuccessScreen)', () => {
    const scanSource = readSource('screens', 'ScanScreen.js')
    const scanSuccessSource = readSource('screens', 'ScanSuccessScreen.js')

    expect(scanSource).not.toContain('showSkipConfirm')
    expect(scanSource).not.toContain('handleSkipPress')
    expect(scanSource).not.toContain('handleSkipConfirmYes')
    expect(scanSource).not.toContain('handleSkipConfirmNo')
    expect(scanSource).not.toContain('Skipping today uses a grace day')
    expect(scanSource).not.toContain('Go back')
    expect(scanSuccessSource).toContain('checkInToday')
  })

  test('TodayScreen uses the functional Spotlight while IntroLaunch retains the orb', () => {
    const todaySource = readSource('screens', 'TodayScreen.js')
    const scanSource = readSource('screens', 'ScanScreen.js')
    const introSource = readSource('screens', 'IntroLaunchScreen.js')

    expect(todaySource).toContain('<TodaysJuiceSpotlight')
    expect(todaySource).toContain('<JuiceSpotlightDetailsModal')
    expect(scanSource).not.toContain('<TodaysJuiceSpotlight')
    expect(scanSource).not.toContain('<JuiceSpotlightDetailsModal')
    expect(introSource).toContain('<LiquidNutrientOrb isReduced={isReduced} />')
  })

  test('Spotlight rendering stays local and does not trigger image recognition', () => {
    const source = readSource('components', 'TodaysJuiceSpotlight.js')

    expect(source).toContain('export function JuiceSpotlightDetailsModal')
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('ClaudeVisionService')
  })
})
