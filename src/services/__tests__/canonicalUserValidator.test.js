// canonicalUserValidator.test.js — Execution-level tests for the H1 fix.
//
// Proves the three validation outcomes (valid, missing, error) are
// handled correctly by actually invoking validateCanonicalUser with
// mock admin clients. Does NOT rely on source-string assertions alone.

const { validateCanonicalUser } = require('../../../supabase/functions/revenuecat-webhook/canonicalUserValidator.ts')

function makeMockAdmin ({ userData, errorMsg } = {}) {
  const calls = []
  const admin = {
    auth: {
      admin: {
        getUserById: async (id) => {
          calls.push(id)
          if (errorMsg) {
            return { data: { user: null }, error: { message: errorMsg } }
          }
          return { data: { user: userData ?? null }, error: null }
        },
      },
    },
  }
  return { admin, calls }
}

describe('H1: validateCanonicalUser — Auth Admin API validation', () => {
  const canonicalUuid = '102c6414-de43-4690-89a1-4b80482ea5a9'

  it('1. VALID USER — lookup succeeds, returns status=valid', async () => {
    const { admin, calls } = makeMockAdmin({ userData: { id: canonicalUuid } })
    const result = await validateCanonicalUser(admin, canonicalUuid)
    expect(result.status).toBe('valid')
    expect(calls).toEqual([canonicalUuid])
  })

  it('2. GENUINE MISSING USER — API returns no error and no user, classified as missing', async () => {
    const { admin, calls } = makeMockAdmin({ userData: null, errorMsg: null })
    const result = await validateCanonicalUser(admin, canonicalUuid)
    expect(result.status).toBe('missing')
    expect(calls).toEqual([canonicalUuid])
  })

  it('3. LOOKUP ERROR — NOT classified as missing; returns status=error with message', async () => {
    const { admin, calls } = makeMockAdmin({ errorMsg: 'Network connection refused' })
    const result = await validateCanonicalUser(admin, canonicalUuid)
    expect(result.status).toBe('error')
    expect(result.message).toBe('Network connection refused')
    expect(result.status).not.toBe('missing')
    expect(calls).toEqual([canonicalUuid])
  })

  it('4. error outcome includes the underlying error message for diagnostics', async () => {
    const { admin } = makeMockAdmin({ errorMsg: 'PGRST205 schema error' })
    const result = await validateCanonicalUser(admin, canonicalUuid)
    expect(result.status).toBe('error')
    expect(result.message).toContain('PGRST205')
  })

  it('5. uses admin.auth.admin.getUserById (not .from auth.users)', async () => {
    // Execution-level proof: the mock admin only exposes auth.admin.getUserById.
    // If the implementation tried .from('auth.users'), it would throw
    // because admin has no .from method.
    const { admin } = makeMockAdmin({ userData: { id: canonicalUuid } })
    expect(typeof admin.auth.admin.getUserById).toBe('function')
    expect(admin.from).toBeUndefined()
    const result = await validateCanonicalUser(admin, canonicalUuid)
    expect(result.status).toBe('valid')
  })
})
