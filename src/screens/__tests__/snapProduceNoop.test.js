const fs = require('fs')
const path = require('path')

describe('Issue 6 — Snap Produce no-op (offline-dev eligibility)', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../HomeScreen.js'),
    'utf-8'
  )

  test('null quota with !SUPABASE_CONFIGURED uses explicit offline-dev path', () => {
    expect(source).toContain('currentQuota === null && !SUPABASE_CONFIGURED')
  })

  test('offline-dev path does not use Infinity as a quota value', () => {
    expect(source).not.toContain('Infinity')
  })

  test('offline-dev path calls checkCameraEligibility with eligible: true', () => {
    const offlineIdx = source.indexOf('!SUPABASE_CONFIGURED')
    const section = source.slice(offlineIdx, offlineIdx + 300)
    expect(section).toContain('eligible: true')
  })

  test('isPreparingCamera state is set and cleared in all paths', () => {
    expect(source).toContain('setIsPreparingCamera(true)')
    expect(source).toContain('setIsPreparingCamera(false)')
  })
})
