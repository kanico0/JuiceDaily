import fs from 'fs'
import path from 'path'

const HOME_SRC = fs.readFileSync(path.join(__dirname, '..', 'HomeScreen.js'), 'utf8')

const STORE_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'JuiceLogStore.js'),
  'utf8',
)

const CHALLENGE_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'ChallengeStore.js'),
  'utf8',
)

describe('Issue 3 — Multiple same-day juice logging', () => {
  describe('JuiceLogStore — no same-day block', () => {
    test('addEntry generates unique id via generateId()', () => {
      expect(STORE_SRC).toContain('id: generateId()')
    })

    test('addEntry generates unique createdAt timestamp', () => {
      expect(STORE_SRC).toContain('createdAt: localISOString()')
    })

    test('ADD_ENTRY prepends to entries array (not replace)', () => {
      expect(STORE_SRC).toContain('entries: [entry, ...state.entries]')
    })

    test('no guard checking existing entries before add', () => {
      expect(STORE_SRC).not.toMatch(/if.*entries.*length.*return/)
      expect(STORE_SRC).not.toMatch(/hasLoggedToday/)
      expect(STORE_SRC).not.toMatch(/alreadyLogged/)
    })

    test('reducer does not deduplicate by dateKey', () => {
      const addCase = STORE_SRC.match(/case 'ADD_ENTRY'[\s\S]*?return/)
      expect(addCase).toBeTruthy()
      expect(addCase[0]).not.toContain('filter')
      expect(addCase[0]).not.toContain('dateKey')
    })
  })

  describe('ChallengeStore LOG_JUICE — appends to juices array', () => {
    test('LOG_JUICE appends juiceData to dayLog.juices', () => {
      expect(CHALLENGE_SRC).toContain('dayLog.juices = [...dayLog.juices, juiceData]')
    })

    test('LOG_JUICE does not check for existing juices', () => {
      const logCase = CHALLENGE_SRC.match(/case 'LOG_JUICE'[\s\S]*?return updated/)
      expect(logCase).toBeTruthy()
      expect(logCase[0]).not.toMatch(/if.*juices.*length/)
      expect(logCase[0]).not.toMatch(/alreadyLogged/)
      expect(logCase[0]).not.toMatch(/hasLogged/)
    })
  })

  describe('HomeScreen — no isLogged guard blocking second log', () => {
    test('isLogged is set to false on every ingredient change', () => {
      const falseCount = (HOME_SRC.match(/setIsLogged\(false\)/g) || []).length
      expect(falseCount).toBeGreaterThanOrEqual(5)
    })

    test('isLogged is set to true only after successful log', () => {
      expect(HOME_SRC).toContain('setIsLogged(true)')
    })

    test('Log button shows when hasItems && !isLogged', () => {
      expect(HOME_SRC).toContain('hasItems && !isLogged')
    })

    test('isLoggingRef prevents double-tap but resets in finally', () => {
      expect(HOME_SRC).toContain('isLoggingRef.current = true')
      expect(HOME_SRC).toContain('isLoggingRef.current = false')
    })

    test('no hasLoggedToday guard in HomeScreen', () => {
      expect(HOME_SRC).not.toMatch(/hasLoggedToday/)
    })

    test('addLogEntry is called unconditionally after logJuice', () => {
      const logSection = HOME_SRC.match(/logJuice\(ingredients[\s\S]*?addLogEntry/)
      expect(logSection).toBeTruthy()
      expect(logSection[0]).not.toMatch(/if.*hasLogged/)
    })
  })

  describe('HomeScreen — error handling prevents silent no-op', () => {
    test('executeLogToChallenge has catch block', () => {
      const execBlock = HOME_SRC.match(/executeLogToChallenge = useCallback[\s\S]*?\}, \[/)
      expect(execBlock).toBeTruthy()
      expect(execBlock[0]).toContain('catch (err)')
    })

    test('catch block shows Alert on error', () => {
      const execBlock = HOME_SRC.match(/executeLogToChallenge = useCallback[\s\S]*?\}, \[/)
      expect(execBlock).toBeTruthy()
      expect(execBlock[0]).toContain('Alert.alert')
    })

    test('finally block resets isLoggingRef', () => {
      const execBlock = HOME_SRC.match(/executeLogToChallenge = useCallback[\s\S]*?\}, \[/)
      expect(execBlock).toBeTruthy()
      expect(execBlock[0]).toContain('finally {')
      expect(execBlock[0]).toContain('isLoggingRef.current = false')
    })
  })
})
