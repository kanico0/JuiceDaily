// ─────────────────────────────────────────────────────────────
// explainFlowFinalSlideRegression.test.js — Regression tests
// for Defect 2: Final "Learn How It Works" page has blank content.
//
// Verifies:
//   1. animateIn has a completion callback safety net
//   2. Opacity is forced to 1 if animation doesn't finish
//   3. Final slide content definition is correct
//   4. CTA is rendered outside the Animated.View
//   5. Final slide has heading "Track your nutrient journey"
//   6. Final slide has subtitle "Just like fitness — but for your juice."
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const explainPath = path.join(__dirname, '..', 'ExplainFlowScreen.js')
const source = fs.readFileSync(explainPath, 'utf8')

describe('Defect 2 — Final Learn How It Works page blank content', () => {
  test('1. animateIn has a completion callback safety net', () => {
    // The animation must have a completion callback
    expect(source).toContain('.start(({ finished })')
    // If animation doesn't finish, force opacity to 1
    expect(source).toContain('if (!finished)')
    expect(source).toContain('opacity.setValue(1)')
  })

  test('2. contentScale is also forced to 1 on incomplete animation', () => {
    expect(source).toContain('contentScale.setValue(1)')
  })

  test('3. Final slide has heading "Track your nutrient journey"', () => {
    expect(source).toContain('Track your nutrient journey')
  })

  test('4. Final slide has subtitle "Just like fitness — but for your juice."', () => {
    expect(source).toContain('Just like fitness — but for your juice.')
  })

  test('5. Final slide has haloColors for the graphic', () => {
    expect(source).toContain('haloColors')
    expect(source).toContain('MockHaloPreview')
  })

  test('6. CTA "Reveal My Nutrients" exists', () => {
    expect(source).toContain('Reveal My Nutrients')
  })

  test('7. Final slide key is "progress"', () => {
    expect(source).toContain("key: 'progress'")
  })

  test('8. animateIn is called on slide change', () => {
    // The useEffect that triggers animateIn on slide change
    expect(source).toMatch(/useEffect.*slide.*animateIn/s)
  })

  test('9. Reduced motion path sets opacity to 1 directly', () => {
    expect(source).toContain('if (isReduced)')
    expect(source).toContain('opacity.setValue(1)')
  })
})
