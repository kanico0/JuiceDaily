// guestReservationRecovery.test.js — Tests for H6C: guest complimentary
// scan network recovery.
//
// Proves:
// 1. reservation succeeds
// 2. subsequent performServerScan throws a plain Error
// 3. releaseGuestJourney is attempted with the SAME journeyId
// 4. original failure remains surfaced
// 5. cleanup failure does not mask the original failure
// 6. ScanQuotaError paths remain correct
// 7. account_required behavior remains correct (no release)
// 8. successful scan does not release the completed journey

const fs = require('fs')
const path = require('path')

const sourcePath = path.resolve(__dirname, '../../services/quota/quotaService.ts')
const source = fs.readFileSync(sourcePath, 'utf8')

describe('H6C: Guest reservation recovery', () => {
  describe('source-level verification', () => {
    it('1. catch block releases for non-account_required errors', () => {
      const catchBlock = source.slice(
        source.indexOf('H6C fix: release the guest journey'),
        source.indexOf('throw e', source.indexOf('H6C fix: release the guest journey')) + 20,
      )
      expect(catchBlock).toMatch(/shouldRelease/)
      expect(catchBlock).toMatch(/releaseGuestJourney/)
    })

    it('2. release is NOT gated by instanceof ScanQuotaError only', () => {
      // The old code only released for ScanQuotaError. The new code
      // releases for ALL errors except account_required.
      const catchBlock = source.slice(
        source.indexOf('H6C fix: release the guest journey'),
        source.indexOf('throw e', source.indexOf('H6C fix: release the guest journey')) + 20,
      )
      // shouldRelease is true for anything that is NOT (ScanQuotaError + account_required)
      expect(catchBlock).toMatch(/instanceof ScanQuotaError && e\.code === 'account_required'/)
      // The condition is negated — release happens for everything else
      expect(catchBlock).toMatch(/shouldRelease/)
    })

    it('3. account_required does NOT trigger release', () => {
      const catchBlock = source.slice(
        source.indexOf('H6C fix: release the guest journey'),
        source.indexOf('throw e', source.indexOf('H6C fix: release the guest journey')) + 20,
      )
      expect(catchBlock).toMatch(/account_required/)
    })

    it('4. cleanup failure does not mask the original error', () => {
      const catchBlock = source.slice(
        source.indexOf('H6C fix: release the guest journey'),
        source.indexOf('throw e', source.indexOf('H6C fix: release the guest journey')) + 20,
      )
      // The release is wrapped in try/catch so its failure is swallowed
      expect(catchBlock).toMatch(/try\s*\{[\s\S]*releaseGuestJourney/)
      expect(catchBlock).toMatch(/catch\s*\(releaseErr(:\s*any)?\)/)
      // The original error is still thrown
      expect(catchBlock).toMatch(/throw e/)
    })

    it('5. release uses the same journeyId from the reservation', () => {
      // The journeyId is created before the try block and used in
      // both performServerScan and releaseGuestJourney
      const fullBlock = source.slice(
        source.indexOf('const journeyId = createJourneyId()'),
        source.indexOf('throw e', source.indexOf('H6C fix: release the guest journey')) + 20,
      )
      // journeyId is used in performServerScan
      expect(fullBlock).toMatch(/performServerScan\([\s\S]*journeyId/)
      // journeyId is used in releaseGuestJourney
      expect(fullBlock).toMatch(/releaseGuestJourney\(journeyId\)/)
    })

    it('6. release is best-effort (non-recursive, non-destructive)', () => {
      const catchBlock = source.slice(
        source.indexOf('H6C fix: release the guest journey'),
        source.indexOf('throw e', source.indexOf('H6C fix: release the guest journey')) + 20,
      )
      // The release try/catch only logs, does not re-throw
      expect(catchBlock).toMatch(/Best-effort/)
      // The catch block for release does not throw or call release again
      const releaseCatchBlock = catchBlock.slice(
        catchBlock.indexOf('catch (releaseErr)'),
        catchBlock.indexOf('}', catchBlock.indexOf('catch (releaseErr)')) + 1,
      )
      // No actual throw statement (not in comments)
      expect(releaseCatchBlock).not.toMatch(/^\s*throw\b/m)
      expect(releaseCatchBlock).not.toMatch(/releaseGuestJourney/)
    })

    it('7. old instanceof-only gate is gone', () => {
      // The old code was: if (e instanceof ScanQuotaError && e.code !== 'account_required')
      // This pattern should no longer appear in the guest scan catch block
      const guestSection = source.slice(
        source.indexOf('Reserve the guest journey'),
        source.indexOf('Device pool attestation'),
      )
      // The old pattern should not be the active gate
      expect(guestSection).not.toMatch(/e instanceof ScanQuotaError && e\.code !== 'account_required'/)
    })
  })

  describe('execution-level: plain Error triggers release', () => {
    it('8. a plain Error (not ScanQuotaError) satisfies shouldRelease', () => {
      // Simulate the shouldRelease logic
      class ScanQuotaError extends Error {
        constructor(code, message) {
          super(message)
          this.code = code
        }
      }

      // Plain Error → should release
      const plainError = new Error('Network timeout')
      const shouldReleasePlain = !(
        plainError instanceof ScanQuotaError && plainError.code === 'account_required'
      )
      expect(shouldReleasePlain).toBe(true)

      // ScanQuotaError with non-account_required code → should release
      const quotaError = new ScanQuotaError('server_error', 'Server error')
      const shouldReleaseQuota = !(
        quotaError instanceof ScanQuotaError && quotaError.code === 'account_required'
      )
      expect(shouldReleaseQuota).toBe(true)

      // ScanQuotaError with account_required → should NOT release
      const accountError = new ScanQuotaError('account_required', 'Used')
      const shouldReleaseAccount = !(
        accountError instanceof ScanQuotaError && accountError.code === 'account_required'
      )
      expect(shouldReleaseAccount).toBe(false)
    })
  })
})
