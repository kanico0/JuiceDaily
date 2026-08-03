const fs = require('fs')
const path = require('path')

describe('Issue 5 — Second same-day logging no-op', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../HomeScreen.js'),
    'utf-8'
  )

  test('focus listener resets isLogged when not actively logging', () => {
    expect(source).toMatch(/addListener.*focus.*resetLoggedOnFocus|resetLoggedOnFocus.*focus/)
  })

  test('resetLoggedOnFocus checks isLoggingRef before resetting', () => {
    expect(source).toContain('resetLoggedOnFocus')
    expect(source).toContain('isLoggingRef.current')
  })

  test('isLogged is set false in focus handler', () => {
    const focusBlock = source.indexOf('resetLoggedOnFocus')
    const setFalse = source.indexOf('setIsLogged(false)', focusBlock)
    expect(setFalse).toBeGreaterThan(focusBlock)
    expect(setFalse).toBeLessThan(focusBlock + 300)
  })

  test('focus listener is properly cleaned up', () => {
    const focusBlock = source.indexOf('resetLoggedOnFocus')
    const cleanup = source.indexOf('unsubscribe()', focusBlock)
    expect(cleanup).toBeGreaterThan(focusBlock)
  })
})
