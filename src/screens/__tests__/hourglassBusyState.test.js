const fs = require('fs')
const path = require('path')

describe('Issue 1 — Hourglass busy state during Log Today', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../HomeScreen.js'),
    'utf-8'
  )

  test('isLogging state is declared', () => {
    expect(source).toContain('isLogging')
    expect(source).toMatch(/setIsLogging\(true\)/)
    expect(source).toMatch(/setIsLogging\(false\)/)
  })

  test('ActivityIndicator is imported from react-native', () => {
    expect(source).toContain('ActivityIndicator')
  })

  test('Log Today button is disabled during logging', () => {
    expect(source).toContain('disabled={isLogging || hasInvalidIngredients}')
  })

  test('Log Today button shows spinner and Logging text during logging', () => {
    expect(source).toContain('ActivityIndicator')
    expect(source).toContain('Logging')
  })

  test('Log Today button has busy style applied during logging', () => {
    expect(source).toContain('logButtonBusy')
  })

  test('accessibilityState busy is set during logging', () => {
    expect(source).toContain('busy: isLogging')
  })

  test('isLogging is set true at start of executeLogToChallenge', () => {
    const execStart = source.indexOf('isLoggingRef.current = true')
    const setTrue = source.indexOf('setIsLogging(true)', execStart)
    expect(setTrue).toBeGreaterThan(execStart)
    expect(setTrue).toBeLessThan(execStart + 200)
  })

  test('isLogging is set false in finally block', () => {
    const finallyIdx = source.indexOf('isLoggingRef.current = false')
    const setFalse = source.indexOf('setIsLogging(false)', finallyIdx)
    expect(setFalse).toBeGreaterThan(finallyIdx)
    expect(setFalse).toBeLessThan(finallyIdx + 200)
  })
})
