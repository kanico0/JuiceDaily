const fs = require('fs')
const path = require('path')

describe('Issue 6 — Snap Produce no-op', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../HomeScreen.js'),
    'utf-8'
  )

  test('null quota is treated as eligible (not exhausted) for offline/dev mode', () => {
    expect(source).toContain('currentQuota === null')
    expect(source).toContain('Infinity')
  })

  test('null quota does not fall through to snap gate with remaining=0', () => {
    const infinityIdx = source.indexOf('Infinity')
    expect(infinityIdx).toBeGreaterThan(-1)
    const nullCheckBefore = source.lastIndexOf('currentQuota === null', infinityIdx)
    expect(nullCheckBefore).toBeGreaterThan(-1)
    expect(infinityIdx - nullCheckBefore).toBeLessThan(200)
  })

  test('snapElig.eligible uses currentRemaining > 0 (which is Infinity for null)', () => {
    expect(source).toContain('eligible: currentRemaining > 0')
  })

  test('currentIsPro falls back to false for null quota', () => {
    const nullCheck = source.indexOf('currentQuota === null')
    const proFallback = source.indexOf('false', source.indexOf('currentIsPro = currentQuota === null'))
    expect(proFallback).toBeGreaterThan(nullCheck)
  })
})
