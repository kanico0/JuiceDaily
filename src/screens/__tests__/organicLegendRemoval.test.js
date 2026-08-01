import fs from 'fs'
import path from 'path'

const HOME_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'HomeScreen.js'),
  'utf8'
)

describe('Item 4 — Remove obsolete organic legend', () => {
  test('organicLegend View is removed from the edit card header', () => {
    expect(HOME_SRC).not.toContain('organicLegend')
  })

  test('"= organic" text is removed', () => {
    expect(HOME_SRC).not.toContain('= organic')
  })

  test('organicLegendText style is removed', () => {
    expect(HOME_SRC).not.toContain('organicLegendText')
  })

  test('organic selection capability is preserved (onToggleOrganic still exists)', () => {
    expect(HOME_SRC).toContain('onToggleOrganic')
  })

  test('organic toggle button is still present', () => {
    expect(HOME_SRC).toContain('organicBtn')
  })

  test('Identified Produce header text remains', () => {
    expect(HOME_SRC).toContain('Identified Produce')
  })
})
