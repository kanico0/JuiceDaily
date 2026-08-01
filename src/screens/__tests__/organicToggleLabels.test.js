import fs from 'fs'
import path from 'path'

const HOME_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'HomeScreen.js'),
  'utf8'
)

describe('Item 3 — Replace leaf-only organic toggle with labels', () => {
  test('organic toggle displays "Organic" text when organic is true', () => {
    expect(HOME_SRC).toContain("{isOrganic ? 'Organic' : 'Non-Organic'}")
  })

  test('organic toggle displays "Non-Organic" text when organic is false', () => {
    expect(HOME_SRC).toContain('Non-Organic')
  })

  test('leaf icon remains as secondary indicator', () => {
    expect(HOME_SRC).toContain('Leaf size={10}')
  })

  test('accessibility label reflects organic state', () => {
    expect(HOME_SRC).toContain("accessibilityLabel={isOrganic ? 'Organic' : 'Non-Organic'}")
  })

  test('accessibility role is switch', () => {
    expect(HOME_SRC).toContain('accessibilityRole="switch"')
  })

  test('accessibility state reflects checked status', () => {
    expect(HOME_SRC).toContain('accessibilityState={{ checked: isOrganic }}')
  })

  test('organicLabel style is defined', () => {
    expect(HOME_SRC).toContain('organicLabel:')
  })

  test('organic button uses flexDirection row for icon+text layout', () => {
    expect(HOME_SRC).toContain('flexDirection: \'row\'')
  })

  test('does not rely on color alone — text labels are present', () => {
    const hasTextLabel = HOME_SRC.includes('Organic') && HOME_SRC.includes('Non-Organic')
    expect(hasTextLabel).toBe(true)
  })

  test('organic toggle appears in both weight and quantity modes', () => {
    const organicOccurrences = (HOME_SRC.match(/onToggleOrganic/g) || []).length
    expect(organicOccurrences).toBeGreaterThanOrEqual(2)
  })
})
