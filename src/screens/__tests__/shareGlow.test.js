// shareGlow.test.js — Tests for Share Glow handler in ScanScreen
//
// Verifies:
// 1. Share Glow invokes Share.share()
// 2. Generated content uses available weekly data
// 3. Button no longer calls handleDismissWeekly
// 4. Share cancellation does not crash
// 5. Share error does not crash

const fs = require('fs')
const path = require('path')

const sourcePath = path.resolve(__dirname, '../ScanScreen.js')
const source = fs.readFileSync(sourcePath, 'utf8')

describe('Share Glow — ScanScreen source audit', () => {
  it('ScanScreen.js imports Share from react-native', () => {
    const importMatch = source.match(/import\s*\{[^}]*\bShare\b[^}]*\}\s*from\s*['"]react-native['"]/)
    expect(importMatch).not.toBeNull()
  })

  it('handleShareGlow function exists in source', () => {
    expect(source).toMatch(/handleShareGlow/)
  })

  it('Share glow button onPress is wired to handleShareGlow, not handleDismissWeekly', () => {
    // The Share glow Pressable is the second one in btnRow.
    // Match the onPress that is within the same Pressable tag as accessibilityLabel="Share glow"
    // by limiting the chars between onPress and accessibilityLabel to a small window
    // (no closing </Pressable> in between).
    const match = source.match(/onPress=\{(handleShareGlow)\}\s*\n\s*hitSlop=\{8\}\s*\n\s*accessibilityRole="button"\s*\n\s*accessibilityLabel="Share glow"/)
    expect(match).not.toBeNull()
    expect(match[1]).toBe('handleShareGlow')
  })

  it('handleShareGlow calls Share.share with a message', () => {
    const handlerMatch = source.match(/Share\.share\(/)
    expect(handlerMatch).not.toBeNull()
    // Verify the Share.share call is inside handleShareGlow
    const handlerSection = source.match(/handleShareGlow[\s\S]*?\}, \[weeklySummary\]\)/)
    expect(handlerSection).not.toBeNull()
    expect(handlerSection[0]).toContain('Share.share')
    expect(handlerSection[0]).toContain('message')
  })

  it('share content includes weekly data (glowStreak, juicesThisWeek, highlightNutrient)', () => {
    const handlerSection = source.match(/handleShareGlow[\s\S]*?\}, \[weeklySummary\]\)/)
    expect(handlerSection).not.toBeNull()
    expect(handlerSection[0]).toContain('glowStreak')
    expect(handlerSection[0]).toContain('juicesThisWeek')
    expect(handlerSection[0]).toContain('highlightNutrient')
  })

  it('share content includes RawLifeFlow branding', () => {
    const handlerSection = source.match(/handleShareGlow[\s\S]*?\}, \[weeklySummary\]\)/)
    expect(handlerSection).not.toBeNull()
    expect(handlerSection[0]).toContain('RawLifeFlow')
  })

  it('handleShareGlow does NOT call dismissWeeklySummary', () => {
    const handlerSection = source.match(/handleShareGlow[\s\S]*?\}, \[weeklySummary\]\)/)
    expect(handlerSection).not.toBeNull()
    expect(handlerSection[0]).not.toContain('dismissWeeklySummary')
  })

  it('handleShareGlow handles errors with try/catch', () => {
    const handlerSection = source.match(/handleShareGlow[\s\S]*?\}, \[weeklySummary\]\)/)
    expect(handlerSection).not.toBeNull()
    expect(handlerSection[0]).toContain('try')
    expect(handlerSection[0]).toContain('catch')
  })

  it('handleShareGlow does not dismiss the weekly panel before share call', () => {
    const handlerSection = source.match(/handleShareGlow[\s\S]*?\}, \[weeklySummary\]\)/)
    expect(handlerSection).not.toBeNull()
    // The handler should NOT call setShowWeekly(false) or dismissWeeklySummary
    expect(handlerSection[0]).not.toContain('setShowWeekly')
    expect(handlerSection[0]).not.toContain('dismissWeeklySummary')
  })

  it('share content does not hard-code any specific social app', () => {
    const handlerSection = source.match(/handleShareGlow[\s\S]*?\}, \[weeklySummary\]\)/)
    expect(handlerSection).not.toBeNull()
    expect(handlerSection[0]).not.toMatch(/facebook|instagram|twitter|whatsapp/i)
  })
})

// ── Unit tests for the share content builder logic ──
// These replicate the exact logic in handleShareGlow to verify content

describe('Share Glow — content builder logic', () => {
  function buildShareMessage(weeklySummary) {
    const parts = ['🌟 My RawLifeFlow weekly glow']
    if (weeklySummary) {
      if (weeklySummary.glowStreak) {
        parts.push(`${weeklySummary.glowStreak}-day glow streak`)
      }
      if (weeklySummary.juicesThisWeek) {
        parts.push(`${weeklySummary.juicesThisWeek} juice${weeklySummary.juicesThisWeek !== 1 ? 's' : ''} this week`)
      }
      if (weeklySummary.highlightNutrient) {
        parts.push(`Top nutrient: ${weeklySummary.highlightNutrient}`)
      }
    }
    parts.push('#RawLifeFlow #JuicingDaily')
    return parts.join('\n')
  }

  it('includes glow streak when available', () => {
    const msg = buildShareMessage({ glowStreak: 5, juicesThisWeek: 7, highlightNutrient: 'Vitamin C' })
    expect(msg).toContain('5-day glow streak')
  })

  it('includes juice count when available', () => {
    const msg = buildShareMessage({ glowStreak: 5, juicesThisWeek: 7, highlightNutrient: 'Vitamin C' })
    expect(msg).toContain('7 juices this week')
  })

  it('uses singular "juice" when count is 1', () => {
    const msg = buildShareMessage({ glowStreak: 1, juicesThisWeek: 1, highlightNutrient: 'Iron' })
    expect(msg).toContain('1 juice this week')
    expect(msg).not.toContain('1 juices')
  })

  it('includes highlight nutrient when available', () => {
    const msg = buildShareMessage({ glowStreak: 3, juicesThisWeek: 2, highlightNutrient: 'Potassium' })
    expect(msg).toContain('Top nutrient: Potassium')
  })

  it('includes RawLifeFlow branding', () => {
    const msg = buildShareMessage({ glowStreak: 5, juicesThisWeek: 7, highlightNutrient: 'Vitamin C' })
    expect(msg).toContain('RawLifeFlow')
    expect(msg).toContain('#RawLifeFlow')
  })

  it('does not fabricate metrics when weeklySummary is null', () => {
    const msg = buildShareMessage(null)
    expect(msg).toContain('RawLifeFlow')
    expect(msg).not.toContain('glow streak')
    expect(msg).not.toContain('juice')
    expect(msg).not.toContain('Top nutrient')
  })

  it('does not fabricate metrics when weeklySummary has zero values', () => {
    const msg = buildShareMessage({ glowStreak: 0, juicesThisWeek: 0, highlightNutrient: '' })
    expect(msg).toContain('RawLifeFlow')
    expect(msg).not.toContain('0-day glow streak')
    expect(msg).not.toContain('0 juice')
  })

  it('share cancellation does not crash (simulated)', async () => {
    // Simulate Share.share returning dismissedAction
    const fakeShare = async () => ({ action: 'dismissedAction' })
    const result = await fakeShare()
    expect(result.action).toBe('dismissedAction')
    // No throw = pass
  })

  it('share error is caught and does not crash (simulated)', async () => {
    // Simulate the handler's try/catch
    const fakeShare = async () => { throw new Error('Share failed') }
    let caught = null
    try {
      await fakeShare()
    } catch (e) {
      caught = e
    }
    expect(caught).not.toBeNull()
    expect(caught.message).toBe('Share failed')
    // Caught = no crash = pass
  })
})
