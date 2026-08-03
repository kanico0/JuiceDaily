const fs = require('fs')
const path = require('path')

describe('Issue 4 — Taste-voting prompt on ScanSuccessScreen', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../ScanSuccessScreen.js'),
    'utf-8'
  )

  test('TASTE_REACTIONS is imported from recipeData', () => {
    expect(source).toContain('TASTE_REACTIONS')
    expect(source).toContain('recipeData')
  })

  test('showTasteFeedback state is declared', () => {
    expect(source).toMatch(/showTasteFeedback/)
    expect(source).toMatch(/setShowTasteFeedback\(true\)/)
    expect(source).toMatch(/setShowTasteFeedback\(false\)/)
  })

  test('Modal is imported from react-native', () => {
    expect(source).toMatch(/Modal/)
  })

  test('taste feedback prompt is shown after a delay', () => {
    expect(source).toMatch(/setTimeout.*setShowTasteFeedback.*true/)
  })

  test('taste feedback modal renders TASTE_REACTIONS options', () => {
    expect(source).toContain('TASTE_REACTIONS.map')
  })

  test('taste feedback modal has How was the taste title', () => {
    expect(source).toContain('How was the taste?')
  })

  test('taste feedback tracks event on selection', () => {
    expect(source).toContain('taste_feedback_submitted')
  })

  test('taste feedback modal has skip button', () => {
    expect(source).toContain('Skip')
  })

  test('taste feedback modal can be dismissed via close button', () => {
    expect(source).toContain('tasteCloseBtn')
  })

  test('taste modal styles are defined', () => {
    expect(source).toContain('tasteOverlay')
    expect(source).toContain('tasteCard')
    expect(source).toContain('tasteOptions')
    expect(source).toContain('tasteBtn')
    expect(source).toContain('tasteEmoji')
    expect(source).toContain('tasteBtnLabel')
  })
})
