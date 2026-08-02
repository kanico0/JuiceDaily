import fs from 'fs'
import path from 'path'

const HOME_SRC = fs.readFileSync(path.join(__dirname, '..', 'HomeScreen.js'), 'utf8')

describe('Issue 2 — Advanced Blend permission loop fix', () => {
  describe('blendApprovedRef guard', () => {
    test('blendApprovedRef is declared', () => {
      expect(HOME_SRC).toContain('blendApprovedRef')
    })

    test('blendApprovedRef is initialized as useRef(false)', () => {
      expect(HOME_SRC).toContain('const blendApprovedRef = useRef(false)')
    })

    test('handleLogToChallenge checks blendApprovedRef before showing modal', () => {
      expect(HOME_SRC).toContain('!blendApprovedRef.current')
    })

    test('handleAdvancedBlendConfirm sets blendApprovedRef to true', () => {
      expect(HOME_SRC).toContain('blendApprovedRef.current = true')
    })

    test('blendApprovedRef is reset in finally block', () => {
      const finallyBlock = HOME_SRC.match(/finally \{[\s\S]*?blendApprovedRef\.current = false/)
      expect(finallyBlock).toBeTruthy()
    })
  })

  describe('isLoggingRef double-tap guard', () => {
    test('isLoggingRef is declared as useRef(false)', () => {
      expect(HOME_SRC).toContain('const isLoggingRef = useRef(false)')
    })

    test('handleLogToChallenge checks isLoggingRef', () => {
      const handleBlock = HOME_SRC.match(
        /handleLogToChallenge = useCallback[\s\S]*?isLoggingRef\.current/,
      )
      expect(handleBlock).toBeTruthy()
    })

    test('executeLogToChallenge checks isLoggingRef', () => {
      const execBlock = HOME_SRC.match(
        /executeLogToChallenge = useCallback[\s\S]*?isLoggingRef\.current/,
      )
      expect(execBlock).toBeTruthy()
    })

    test('executeLogToChallenge sets isLoggingRef to true at start', () => {
      expect(HOME_SRC).toContain('isLoggingRef.current = true')
    })

    test('isLoggingRef is reset in finally block', () => {
      const finallyBlock = HOME_SRC.match(/finally \{[\s\S]*?isLoggingRef\.current = false/)
      expect(finallyBlock).toBeTruthy()
    })
  })

  describe('guest gate ordering — pre-check before blend', () => {
    test('isGuestLogAllowed is imported', () => {
      expect(HOME_SRC).toContain('isGuestLogAllowed')
    })

    test('isGuestLogAllowed pre-check comes before authorizeAndProcessBatch', () => {
      const preCheckPos = HOME_SRC.indexOf('isGuestLogAllowed()')
      const blendPos = HOME_SRC.indexOf('authorizeAndProcessBatch(')
      expect(preCheckPos).toBeGreaterThan(-1)
      expect(blendPos).toBeGreaterThan(-1)
      expect(preCheckPos).toBeLessThan(blendPos)
    })

    test('authorizeGuestLog (finalizing) is called after blend succeeds', () => {
      const finalizingPos = HOME_SRC.indexOf('authorizeGuestLog()')
      const blendPos = HOME_SRC.indexOf('authorizeAndProcessBatch(')
      expect(finalizingPos).toBeGreaterThan(-1)
      expect(finalizingPos).toBeGreaterThan(blendPos)
    })

    test('non-finalizing pre-check does not call authorizeGuestLog', () => {
      const preCheckBlock = HOME_SRC.match(/isGuestLogAllowed\(\)[\s\S]*?setShowAccountGate/)
      expect(preCheckBlock).toBeTruthy()
      expect(preCheckBlock[0]).not.toContain('authorizeGuestLog')
    })
  })

  describe('try/catch/finally structure', () => {
    test('executeLogToChallenge has outer try block', () => {
      const execBlock = HOME_SRC.match(/executeLogToChallenge = useCallback[\s\S]*?\}, \[/)
      expect(execBlock).toBeTruthy()
      expect(execBlock[0]).toContain('try {')
    })

    test('executeLogToChallenge has catch block with Alert', () => {
      const execBlock = HOME_SRC.match(/executeLogToChallenge = useCallback[\s\S]*?\}, \[/)
      expect(execBlock).toBeTruthy()
      expect(execBlock[0]).toContain('catch (err)')
      expect(execBlock[0]).toContain('Alert.alert')
    })

    test('executeLogToChallenge has finally block resetting refs', () => {
      const execBlock = HOME_SRC.match(/executeLogToChallenge = useCallback[\s\S]*?\}, \[/)
      expect(execBlock).toBeTruthy()
      expect(execBlock[0]).toContain('finally {')
      expect(execBlock[0]).toContain('isLoggingRef.current = false')
      expect(execBlock[0]).toContain('blendApprovedRef.current = false')
      expect(execBlock[0]).toContain('blendOperationIdRef.current = null')
    })

    test('blendCheckInProgress is reset in inner finally', () => {
      const blendBlock = HOME_SRC.match(
        /blendType === 'advanced'[\s\S]*?setBlendCheckInProgress\(false\)/,
      )
      expect(blendBlock).toBeTruthy()
      expect(blendBlock[0]).toContain('finally {')
      expect(blendBlock[0]).toContain('setBlendCheckInProgress(false)')
    })
  })

  describe('dependency array fixes', () => {
    test('handleLogToChallenge includes executeLogToChallenge in deps', () => {
      const handleBlock = HOME_SRC.match(
        /handleLogToChallenge = useCallback[\s\S]*?\}, \[([^\]]+)\]/,
      )
      expect(handleBlock).toBeTruthy()
      expect(handleBlock[1]).toContain('executeLogToChallenge')
    })

    test('executeLogToChallenge includes addLogEntry in deps', () => {
      const execBlock = HOME_SRC.match(
        /executeLogToChallenge = useCallback[\s\S]*?\}, \[([^\]]+)\]/,
      )
      expect(execBlock).toBeTruthy()
      expect(execBlock[1]).toContain('addLogEntry')
    })
  })
})
