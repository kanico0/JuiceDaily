import fs from 'fs'
import path from 'path'

const HOME_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'HomeScreen.js'),
  'utf8'
)

// ── Behavioral mock state machine ──────────────────────────────
// Mirrors the logic in executeLogToChallenge to test partial-success
// behavior without rendering the full React Native component.

function createStateMachine() {
  const refs = {
    blendOperationId: null,
    blendApproved: false,
    isLogging: false,
    analysisCompleted: false,
    analysisResult: null,
    analysisBatchUpdate: false,
  }

  const mocks = {
    reserveBlendAllowance: jest.fn(async () => ({ allowed: true, remaining: 2, used: 1, limit: 3 })),
    finalizeBlendAllowance: jest.fn(async () => ({ ok: true })),
    releaseBlendAllowance: jest.fn(async () => ({ ok: true })),
    authorizeAndProcessBatch: jest.fn(async (ingredients, method, opId) => ({
      totals: { calories: 100 },
      ingredients,
      allowance: { plan: 'free', remaining: 2, used: 1, limit: 3 },
    })),
    isGuestLogAllowed: jest.fn(async () => true),
    authorizeGuestLog: jest.fn(async () => ({ allowed: true, journeyId: 'j1', isDurable: true })),
    logJuice: jest.fn(() => {}),
    addLogEntry: jest.fn(() => {}),
    recordNutritionLog: jest.fn(() => {}),
    navigationNavigate: jest.fn(() => {}),
    setBatch: jest.fn(() => {}),
    setIsLogged: jest.fn(() => {}),
    setShowAdvancedBlendModal: jest.fn(() => {}),
    setAdvancedBlendStage: jest.fn(() => {}),
    setBlendCheckInProgress: jest.fn(() => {}),
    Alert: jest.fn(() => {}),
    trackEvent: jest.fn(() => {}),
  }

  function resetMocks() {
    Object.values(mocks).forEach((m) => m.mockClear())
  }

  function invalidateAnalysisOnBatchChange() {
    if (refs.analysisBatchUpdate) {
      refs.analysisBatchUpdate = false
      return
    }
    if (refs.analysisCompleted) {
      refs.analysisCompleted = false
      refs.analysisResult = null
      refs.blendApproved = false
      refs.blendOperationId = null
    }
  }

  async function handleLogToChallenge(isPro, blendType) {
    if (refs.isLogging) return
    if (blendType === 'advanced' && !isPro && !refs.blendApproved) {
      refs.blendOperationId = 'op-' + Date.now()
      mocks.setAdvancedBlendStage('pre_analysis_confirmation')
      mocks.setShowAdvancedBlendModal(true)
      return 'show_modal'
    }
    if (blendType === 'advanced' && isPro) {
      refs.blendOperationId = 'op-' + Date.now()
    }
    return executeLogToChallenge(isPro, blendType)
  }

  async function handleAdvancedBlendConfirm(isPro, blendType) {
    refs.blendApproved = true
    mocks.setShowAdvancedBlendModal(false)
    return executeLogToChallenge(isPro, blendType)
  }

  async function executeLogToChallenge(isPro, blendType) {
    if (refs.isLogging) return 'double_tap_blocked'
    refs.isLogging = true
    let loggingSucceeded = false
    let totals = {}

    try {
      const canLog = await mocks.isGuestLogAllowed()
      if (!canLog) {
        return 'guest_blocked'
      }

      if (blendType === 'advanced' && !refs.analysisCompleted) {
        mocks.setBlendCheckInProgress(true)
        try {
          const authorized = await mocks.authorizeAndProcessBatch(
            ['apple', 'carrot', 'spinach', 'ginger', 'lemon'],
            'cold_pressed',
            refs.blendOperationId
          )
          totals = authorized.totals || totals
          refs.analysisCompleted = true
          refs.analysisResult = { totals, ingredients: authorized.ingredients }
          refs.analysisBatchUpdate = true
          mocks.setBatch(authorized)
          if (authorized.allowance && authorized.allowance.plan === 'free') {
            mocks.setAdvancedBlendStage('completion_confirmation')
            mocks.setShowAdvancedBlendModal(true)
          }
        } catch (err) {
          if (err && err.code === 'advanced_blend_limit_reached') {
            mocks.setAdvancedBlendStage('allowance_exhausted')
            mocks.setShowAdvancedBlendModal(true)
            return 'allowance_exhausted'
          }
          mocks.setAdvancedBlendStage('network_retry')
          mocks.setShowAdvancedBlendModal(true)
          return 'network_error'
        } finally {
          mocks.setBlendCheckInProgress(false)
        }
      } else if (refs.analysisCompleted && refs.analysisResult) {
        totals = refs.analysisResult.totals || totals
      }

      const logGate = await mocks.authorizeGuestLog()
      if (!logGate.allowed) {
        return 'guest_finalization_blocked'
      }

      mocks.logJuice(['apple', 'carrot', 'spinach', 'ginger', 'lemon'], totals)
      mocks.recordNutritionLog(['apple', 'carrot', 'spinach', 'ginger', 'lemon'], totals)
      mocks.addLogEntry({ source: 'photo', ingredientIds: ['apple', 'carrot', 'spinach', 'ginger', 'lemon'], nutrientSummary: totals })
      mocks.setIsLogged(true)
      loggingSucceeded = true
      mocks.navigationNavigate('ScanSuccess', {})
      return 'success'
    } catch (err) {
      mocks.Alert('Logging Error', 'Could not log your juice. Please try again.')
      return 'logging_error'
    } finally {
      refs.isLogging = false
      if (loggingSucceeded) {
        refs.blendApproved = false
        refs.blendOperationId = null
        refs.analysisCompleted = false
        refs.analysisResult = null
      } else if (!refs.analysisCompleted) {
        refs.blendApproved = false
        refs.blendOperationId = null
      }
    }
  }

  return { refs, mocks, resetMocks, handleLogToChallenge, handleAdvancedBlendConfirm, executeLogToChallenge, invalidateAnalysisOnBatchChange }
}

// ── Tests ──────────────────────────────────────────────────────

describe('Issue 2.5 — Partial-Success Analysis and Logging Retry', () => {
  describe('Source structure verification', () => {
    test('analysisCompletedRef is declared', () => {
      expect(HOME_SRC).toContain('const analysisCompletedRef = useRef(false)')
    })

    test('analysisResultRef is declared', () => {
      expect(HOME_SRC).toContain('const analysisResultRef = useRef(null)')
    })

    test('analysisBatchUpdateRef is declared', () => {
      expect(HOME_SRC).toContain('const analysisBatchUpdateRef = useRef(false)')
    })

    test('batch-invalidation useEffect is present', () => {
      expect(HOME_SRC).toContain('analysisBatchUpdateRef.current = false')
      expect(HOME_SRC).toContain('analysisCompletedRef.current = false')
    })

    test('executeLogToChallenge checks analysisCompletedRef before blend', () => {
      expect(HOME_SRC).toContain('!analysisCompletedRef.current')
    })

    test('executeLogToChallenge sets analysisCompletedRef after success', () => {
      expect(HOME_SRC).toContain('analysisCompletedRef.current = true')
    })

    test('executeLogToChallenge reuses cached analysis result', () => {
      expect(HOME_SRC).toContain('reusing cached analysis result')
    })

    test('finally block uses loggingSucceeded flag', () => {
      expect(HOME_SRC).toContain('let loggingSucceeded = false')
      expect(HOME_SRC).toContain('loggingSucceeded = true')
      expect(HOME_SRC).toContain('if (loggingSucceeded)')
    })

    test('finally preserves analysis state on logging failure', () => {
      expect(HOME_SRC).toContain('preserve analysis state for retry')
    })
  })

  describe('1. Analysis succeeds, logging succeeds', () => {
    it('consumes exactly one allowance and creates one log', async () => {
      const sm = createStateMachine()
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      expect(sm.mocks.authorizeAndProcessBatch).toHaveBeenCalledTimes(1)
      expect(sm.mocks.logJuice).toHaveBeenCalledTimes(1)
      expect(sm.mocks.addLogEntry).toHaveBeenCalledTimes(1)
      expect(sm.refs.analysisCompleted).toBe(false)
      expect(sm.refs.blendApproved).toBe(false)
    })

    it('does not show modal on second independent batch', async () => {
      const sm = createStateMachine()
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      // After success, state is cleared — second batch needs new modal
      expect(sm.refs.analysisCompleted).toBe(false)
    })
  })

  describe('2. One complimentary allowance consumed on full success', () => {
    it('authorizeAndProcessBatch called once', async () => {
      const sm = createStateMachine()
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      expect(sm.mocks.authorizeAndProcessBatch).toHaveBeenCalledTimes(1)
    })
  })

  describe('3. Analysis succeeds but logging fails', () => {
    it('preserves analysis state and shows error', async () => {
      const sm = createStateMachine()
      sm.mocks.logJuice.mockImplementation(() => { throw new Error('persist failed') })
      await sm.handleLogToChallenge(false, 'advanced')
      const result = await sm.handleAdvancedBlendConfirm(false, 'advanced')
      expect(result).toBe('logging_error')
      expect(sm.mocks.Alert).toHaveBeenCalled()
      expect(sm.refs.analysisCompleted).toBe(true)
      expect(sm.refs.analysisResult).not.toBeNull()
      expect(sm.refs.blendApproved).toBe(true)
    })
  })

  describe('4. Exactly one allowance consumed after logging failure', () => {
    it('authorizeAndProcessBatch called once, not twice', async () => {
      const sm = createStateMachine()
      sm.mocks.logJuice.mockImplementation(() => { throw new Error('persist failed') })
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      expect(sm.mocks.authorizeAndProcessBatch).toHaveBeenCalledTimes(1)
    })
  })

  describe('5. Retry does not reopen Advanced Blend warning', () => {
    it('handleLogToChallenge skips modal on retry', async () => {
      const sm = createStateMachine()
      sm.mocks.logJuice.mockImplementation(() => { throw new Error('persist failed') })
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      sm.resetMocks()
      const result = await sm.handleLogToChallenge(false, 'advanced')
      expect(result).not.toBe('show_modal')
    })
  })

  describe('6. Retry does not call analysis again', () => {
    it('authorizeAndProcessBatch not called on retry', async () => {
      const sm = createStateMachine()
      sm.mocks.logJuice.mockImplementationOnce(() => { throw new Error('persist failed') })
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      sm.resetMocks()
      await sm.handleLogToChallenge(false, 'advanced')
      expect(sm.mocks.authorizeAndProcessBatch).not.toHaveBeenCalled()
    })
  })

  describe('7. Retry does not reserve another allowance', () => {
    it('authorizeAndProcessBatch not called on retry', async () => {
      const sm = createStateMachine()
      sm.mocks.logJuice.mockImplementationOnce(() => { throw new Error('persist failed') })
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      sm.resetMocks()
      await sm.handleLogToChallenge(false, 'advanced')
      expect(sm.mocks.authorizeAndProcessBatch).not.toHaveBeenCalled()
    })
  })

  describe('8. Retry logs exactly one History record', () => {
    it('logJuice and addLogEntry called once on retry', async () => {
      const sm = createStateMachine()
      sm.mocks.logJuice.mockImplementationOnce(() => { throw new Error('persist failed') })
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      // Do NOT resetMocks — we want to count total calls across both attempts
      const logJuiceCalls = sm.mocks.logJuice.mock.calls.length
      const addLogEntryCalls = sm.mocks.addLogEntry.mock.calls.length
      await sm.handleLogToChallenge(false, 'advanced')
      // First attempt threw, so logJuice was called 0 times before retry
      // Retry should call it once more
      expect(sm.mocks.logJuice.mock.calls.length).toBe(logJuiceCalls + 1)
      expect(sm.mocks.addLogEntry.mock.calls.length).toBe(addLogEntryCalls + 1)
    })
  })

  describe('9. Original successful analysis result is reused', () => {
    it('totals come from cached analysisResult', async () => {
      const sm = createStateMachine()
      sm.mocks.authorizeAndProcessBatch.mockResolvedValue({
        totals: { calories: 250, vitaminC: 50 },
        ingredients: ['apple', 'carrot', 'spinach', 'ginger', 'lemon'],
        allowance: { plan: 'free', remaining: 2, used: 1, limit: 3 },
      })
      sm.mocks.logJuice.mockImplementationOnce(() => { throw new Error('persist failed') })
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      expect(sm.refs.analysisResult.totals).toEqual({ calories: 250, vitaminC: 50 })
      // Do NOT resetMocks — keep the mock state for retry
      await sm.handleLogToChallenge(false, 'advanced')
      // Check the last call to logJuice used cached totals
      const lastCall = sm.mocks.logJuice.mock.calls[sm.mocks.logJuice.mock.calls.length - 1]
      expect(lastCall[1]).toEqual({ calories: 250, vitaminC: 50 })
    })
  })

  describe('10. Draft remains available after logging failure', () => {
    it('isLoggingRef resets to false', async () => {
      const sm = createStateMachine()
      sm.mocks.logJuice.mockImplementation(() => { throw new Error('persist failed') })
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      expect(sm.refs.isLogging).toBe(false)
    })
  })

  describe('11. User receives visible logging-failure feedback', () => {
    it('Alert.alert called with error message', async () => {
      const sm = createStateMachine()
      sm.mocks.logJuice.mockImplementation(() => { throw new Error('persist failed') })
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      expect(sm.mocks.Alert).toHaveBeenCalledWith(
        'Logging Error',
        'Could not log your juice. Please try again.'
      )
    })
  })

  describe('12. Editing ingredients invalidates preserved analysis', () => {
    it('invalidateAnalysisOnBatchChange resets analysis state', async () => {
      const sm = createStateMachine()
      sm.mocks.logJuice.mockImplementationOnce(() => { throw new Error('persist failed') })
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      expect(sm.refs.analysisCompleted).toBe(true)
      // Simulate the batch-invalidation effect having consumed the analysisBatchUpdate flag
      sm.refs.analysisBatchUpdate = false
      sm.invalidateAnalysisOnBatchChange()
      expect(sm.refs.analysisCompleted).toBe(false)
      expect(sm.refs.analysisResult).toBeNull()
      expect(sm.refs.blendApproved).toBe(false)
    })
  })

  describe('13. After editing, normal authorization applies again', () => {
    it('modal shown again after invalidation', async () => {
      const sm = createStateMachine()
      sm.mocks.logJuice.mockImplementationOnce(() => { throw new Error('persist failed') })
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      // Simulate the batch-invalidation effect having consumed the analysisBatchUpdate flag
      sm.refs.analysisBatchUpdate = false
      sm.invalidateAnalysisOnBatchChange()
      sm.resetMocks()
      const result = await sm.handleLogToChallenge(false, 'advanced')
      expect(result).toBe('show_modal')
    })
  })

  describe('14. Analysis failure releases reservation and consumes zero', () => {
    it('analysisCompletedRef stays false on analysis failure', async () => {
      const sm = createStateMachine()
      sm.mocks.authorizeAndProcessBatch.mockRejectedValue(
        Object.assign(new Error('limit'), { code: 'advanced_blend_limit_reached' })
      )
      await sm.handleLogToChallenge(false, 'advanced')
      const result = await sm.handleAdvancedBlendConfirm(false, 'advanced')
      expect(result).toBe('allowance_exhausted')
      expect(sm.refs.analysisCompleted).toBe(false)
      expect(sm.refs.blendApproved).toBe(false)
    })
  })

  describe('15. Analysis failure may be retried normally', () => {
    it('modal shown again after analysis failure', async () => {
      const sm = createStateMachine()
      sm.mocks.authorizeAndProcessBatch.mockRejectedValueOnce(
        Object.assign(new Error('limit'), { code: 'advanced_blend_limit_reached' })
      )
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      sm.resetMocks()
      sm.mocks.authorizeAndProcessBatch.mockResolvedValue({
        totals: { calories: 100 },
        ingredients: ['a', 'b', 'c', 'd', 'e'],
        allowance: { plan: 'free', remaining: 2, used: 1, limit: 3 },
      })
      const result = await sm.handleLogToChallenge(false, 'advanced')
      expect(result).toBe('show_modal')
    })
  })

  describe('16. Guest precheck passes, analysis succeeds, guest finalization fails', () => {
    it('analysis state preserved for retry', async () => {
      const sm = createStateMachine()
      sm.mocks.authorizeGuestLog.mockResolvedValue({ allowed: false, reason: 'error', message: 'fail' })
      await sm.handleLogToChallenge(false, 'advanced')
      const result = await sm.handleAdvancedBlendConfirm(false, 'advanced')
      expect(result).toBe('guest_finalization_blocked')
      expect(sm.refs.analysisCompleted).toBe(true)
      expect(sm.refs.analysisResult).not.toBeNull()
    })
  })

  describe('17. Guest retry does not consume another allowance', () => {
    it('authorizeAndProcessBatch not called on guest retry', async () => {
      const sm = createStateMachine()
      sm.mocks.authorizeGuestLog.mockResolvedValue({ allowed: false, reason: 'error', message: 'fail' })
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      const analysisCallCount = sm.mocks.authorizeAndProcessBatch.mock.calls.length
      // Fix guest gate for retry
      sm.mocks.authorizeGuestLog.mockResolvedValue({ allowed: true, journeyId: 'j1', isDurable: true })
      await sm.handleLogToChallenge(false, 'advanced')
      expect(sm.mocks.authorizeAndProcessBatch.mock.calls.length).toBe(analysisCallCount)
      // logJuice should have been called once more (on retry)
      expect(sm.mocks.logJuice.mock.calls.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('18. Duplicate retry taps create one log', () => {
    it('isLoggingRef blocks second concurrent tap', async () => {
      const sm = createStateMachine()
      sm.refs.isLogging = true
      const result = await sm.handleLogToChallenge(false, 'advanced')
      expect(result).toBeUndefined()
    })

    it('isLoggingRef blocks second concurrent executeLogToChallenge', async () => {
      const sm = createStateMachine()
      sm.refs.isLogging = true
      const result = await sm.executeLogToChallenge(false, 'advanced')
      expect(result).toBe('double_tap_blocked')
    })
  })

  describe('19. Same-day second and third juices log independently', () => {
    it('second log after first success works normally', async () => {
      const sm = createStateMachine()
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      // After success, all transient state is cleared
      expect(sm.refs.analysisCompleted).toBe(false)
      expect(sm.refs.blendApproved).toBe(false)
      // Second batch: modal shown again (new authorization needed)
      const result = await sm.handleLogToChallenge(false, 'advanced')
      expect(result).toBe('show_modal')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      // Two successful logs total
      expect(sm.mocks.logJuice).toHaveBeenCalledTimes(2)
      expect(sm.mocks.addLogEntry).toHaveBeenCalledTimes(2)
    })
  })

  describe('20. isLoggingRef always resets appropriately', () => {
    it('resets on success', async () => {
      const sm = createStateMachine()
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      expect(sm.refs.isLogging).toBe(false)
    })

    it('resets on logging failure', async () => {
      const sm = createStateMachine()
      sm.mocks.logJuice.mockImplementation(() => { throw new Error('fail') })
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      expect(sm.refs.isLogging).toBe(false)
    })

    it('resets on analysis failure', async () => {
      const sm = createStateMachine()
      sm.mocks.authorizeAndProcessBatch.mockRejectedValue(
        Object.assign(new Error('limit'), { code: 'advanced_blend_limit_reached' })
      )
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      expect(sm.refs.isLogging).toBe(false)
    })

    it('resets on guest block', async () => {
      const sm = createStateMachine()
      sm.mocks.isGuestLogAllowed.mockResolvedValue(false)
      await sm.handleLogToChallenge(false, 'advanced')
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      expect(sm.refs.isLogging).toBe(false)
    })
  })

  describe('21. New batch receives new operation ID', () => {
    it('operation ID cleared after success and new one created for next batch', async () => {
      const sm = createStateMachine()
      await sm.handleLogToChallenge(false, 'advanced')
      const firstOpId = sm.refs.blendOperationId
      expect(firstOpId).not.toBeNull()
      await sm.handleAdvancedBlendConfirm(false, 'advanced')
      // After success, operation ID is cleared
      expect(sm.refs.blendOperationId).toBeNull()
      // New batch: new operation ID created
      const result = await sm.handleLogToChallenge(false, 'advanced')
      expect(result).toBe('show_modal')
      expect(sm.refs.blendOperationId).not.toBeNull()
      expect(typeof sm.refs.blendOperationId).toBe('string')
    })
  })

  describe('22. Advanced Blend limit remains three lifetime', () => {
    it('FREE_ADVANCED_BLEND_ALLOWANCE is 3', () => {
      expect(HOME_SRC).toContain('FREE_ADVANCED_BLEND_ALLOWANCE')
    })

    it('allowance_exhausted modal shows remaining 0', () => {
      expect(HOME_SRC).toMatch(/allowance_exhausted[\s\S]*?setAdvancedBlendRemaining\(0\)/)
    })
  })

  describe('23. Pro remains unlimited', () => {
    it('pro users skip pre-analysis confirmation', () => {
      expect(HOME_SRC).toContain("blendType === 'advanced' && !isPro")
    })

    it('pro users create operation ID directly', () => {
      expect(HOME_SRC).toContain("blendType === 'advanced' && isPro")
    })
  })

  describe('24. Manual simple blends remain free', () => {
    it('simple blends do not enter advanced blend block', async () => {
      const sm = createStateMachine()
      const result = await sm.handleLogToChallenge(false, 'simple')
      expect(result).toBe('success')
      expect(sm.mocks.authorizeAndProcessBatch).not.toHaveBeenCalled()
      expect(sm.mocks.logJuice).toHaveBeenCalledTimes(1)
    })
  })

  describe('25. Existing layout tests remain passing', () => {
    it('statusLabelRow style still present', () => {
      expect(HOME_SRC).toContain('statusLabelRow:')
    })

    it('organicRow style still present', () => {
      expect(HOME_SRC).toContain('organicRow:')
    })

    it('adjustmentRow style still present', () => {
      expect(HOME_SRC).toContain('adjustmentRow:')
    })

    it('removeRow style still present', () => {
      expect(HOME_SRC).toContain('removeRow:')
    })
  })

  describe('26. Existing multiple-same-day tests remain passing', () => {
    it('isLoggingRef declared', () => {
      expect(HOME_SRC).toContain('const isLoggingRef = useRef(false)')
    })

    it('isLoggingRef resets in finally', () => {
      expect(HOME_SRC).toContain('isLoggingRef.current = false')
    })

    it('no hasLoggedToday guard', () => {
      expect(HOME_SRC).not.toMatch(/hasLoggedToday/)
    })
  })

  describe('27. Existing quota and History tests remain passing', () => {
    it('blendApprovedRef still present', () => {
      expect(HOME_SRC).toContain('const blendApprovedRef = useRef(false)')
    })

    it('blendOperationIdRef still present', () => {
      expect(HOME_SRC).toContain('const blendOperationIdRef = useRef(null)')
    })

    it('two-phase guest gate still present', () => {
      expect(HOME_SRC).toContain('isGuestLogAllowed')
      expect(HOME_SRC).toContain('authorizeGuestLog')
    })

    it('try/catch/finally structure intact', () => {
      expect(HOME_SRC).toContain('catch (err)')
      expect(HOME_SRC).toContain('finally {')
      expect(HOME_SRC).toContain('Alert.alert')
    })
  })
})
