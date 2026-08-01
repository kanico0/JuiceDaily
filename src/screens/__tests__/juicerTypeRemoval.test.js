import fs from 'fs'
import path from 'path'

const HOME_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'HomeScreen.js'),
  'utf8'
)

const SETTINGS_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'SettingsScreen.js'),
  'utf8'
)

describe('Item 6 — Remove Cold Press and Centrifugal from Juice Snap', () => {
  test('juice method toggle UI is removed from HomeScreen', () => {
    expect(HOME_SRC).not.toContain('juiceMethodRow')
  })

  test('Cold Pressed button is removed from HomeScreen', () => {
    expect(HOME_SRC).not.toContain('Cold Pressed')
  })

  test('Centrifugal button is removed from HomeScreen', () => {
    expect(HOME_SRC).not.toContain('>Centrifugal<')
  })

  test('handleToggleJuiceMethod is removed from HomeScreen', () => {
    expect(HOME_SRC).not.toContain('handleToggleJuiceMethod')
  })

  test('juiceMethod state is preserved for calculations', () => {
    expect(HOME_SRC).toContain('juiceMethod')
  })

  test('juiceMethod hydration from AsyncStorage is preserved', () => {
    expect(HOME_SRC).toContain('JUICE_METHOD_STORAGE_KEY')
  })

  test('Settings screen still has juicer type control', () => {
    expect(SETTINGS_SRC).toContain('My Juicer Type')
  })

  test('Settings screen still has cold_pressed option', () => {
    expect(SETTINGS_SRC).toContain('cold_pressed')
  })

  test('Settings screen still has centrifugal option', () => {
    expect(SETTINGS_SRC).toContain('centrifugal')
  })

  test('Settings screen still has handleSetJuicerType', () => {
    expect(SETTINGS_SRC).toContain('handleSetJuicerType')
  })
})
