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

  test('ScanScreen Glow Streak card prompts log-driven action instead of direct check-in', () => {
    const scanSource = readSource('screens', 'ScanScreen.js')

    expect(scanSource).toContain('handleLogTodayJuice')
    expect(scanSource).toContain("Log today's juice to keep your Glow Streak going.")
    expect(scanSource).toContain("Log today's juice")
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

  test('checked-in state shows completed message', () => {
    const scanSource = readSource('screens', 'ScanScreen.js')

    expect(scanSource).toContain("You're checked in for today")
  })

  test('Not today skip shows confirmation before mutation', () => {
    const scanSource = readSource('screens', 'ScanScreen.js')

    expect(scanSource).toContain('showSkipConfirm')
    expect(scanSource).toContain('handleSkipPress')
    expect(scanSource).toContain('handleSkipConfirmYes')
    expect(scanSource).toContain('handleSkipConfirmNo')
    expect(scanSource).toContain('Skipping today uses a grace day')
    expect(scanSource).toContain('Go back')
  })

  test('Explore BrowseHome uses the functional Spotlight while IntroLaunch retains the orb', () => {
    const scanSource = readSource('screens', 'ScanScreen.js')
    const introSource = readSource('screens', 'IntroLaunchScreen.js')
    const browseHomeSource = scanSource.slice(scanSource.indexOf('function BrowseHome'), scanSource.indexOf('const browseHomeStyles'))

    expect(browseHomeSource).toContain('<TodaysJuiceSpotlight')
    expect(browseHomeSource).not.toContain('<LiquidNutrientOrb')
    expect(browseHomeSource).toContain('<JuiceSpotlightDetailsModal')
    expect(introSource).toContain('<LiquidNutrientOrb isReduced={isReduced} />')
  })

  test('Spotlight rendering stays local and does not trigger image recognition', () => {
    const source = readSource('components', 'TodaysJuiceSpotlight.js')

    expect(source).toContain('export function JuiceSpotlightDetailsModal')
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('ClaudeVisionService')
  })
})
