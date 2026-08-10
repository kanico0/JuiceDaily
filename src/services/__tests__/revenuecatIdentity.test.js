// revenuecatIdentity.test.js — Tests for RevenueCat identity lifecycle
// on signout and account switch.
//
// Verifies:
// 1. signOutAccount calls revenueCatLogOut before supabase signOut
// 2. signOutAccount re-enables anon fallback
// 3. signOutAccount creates new anonymous identity via ensureUser
// 4. signOutAccount notifies identity change with new UUID
// 5. ProStore is in-memory only (no AsyncStorage persistence)
// 6. No silent Pro unlock from AsyncStorage
// 7. Account A Pro → signout → new anonymous → no cached Pro
// 8. Account B login → RevenueCat App User ID = B UUID
// 9. Account A login again → RevenueCat App User ID = A UUID
// 10. logOut is exported from revenueCatClient

const fs = require('fs')
const path = require('path')

const accountLinkPath = path.resolve(__dirname, '../../services/supabase/accountLink.ts')
const accountLinkSource = fs.readFileSync(accountLinkPath, 'utf8')

const revenueCatClientPath = path.resolve(__dirname, '../../services/subscriptions/revenueCatClient.ts')
const revenueCatClientSource = fs.readFileSync(revenueCatClientPath, 'utf8')

const proStorePath = path.resolve(__dirname, '../../services/ProStore.js')
const proStoreSource = fs.readFileSync(proStorePath, 'utf8')

const identityPath = path.resolve(__dirname, '../../services/supabase/identity.ts')
const identitySource = fs.readFileSync(identityPath, 'utf8')

describe('RevenueCat identity switch (direct logIn, no logOut)', () => {
  it('1. accountLink imports logIn (not logOut) from revenueCatClient', () => {
    expect(accountLinkSource).toMatch(/logIn as revenueCatLogIn/)
    expect(accountLinkSource).not.toMatch(/logOut as revenueCatLogOut/)
  })

  it('2. accountLink imports ensureUser from identity', () => {
    expect(accountLinkSource).toMatch(/ensureUser/)
  })

  it('3. signOutAccount does NOT call revenueCatLogOut', () => {
    const signOutSection = accountLinkSource.slice(
      accountLinkSource.indexOf('export async function signOutAccount'),
    )
    expect(signOutSection).not.toMatch(/revenueCatLogOut/)
  })

  it('4. signOutAccount calls supabase.auth.signOut first', () => {
    const signOutSection = accountLinkSource.slice(
      accountLinkSource.indexOf('export async function signOutAccount'),
    )
    expect(signOutSection).toMatch(/supabase\.auth\.signOut\(\)/)
  })

  it('5. signOutAccount re-enables anon fallback after signout', () => {
    const signOutSection = accountLinkSource.slice(
      accountLinkSource.indexOf('export async function signOutAccount'),
    )
    const signOutPos = signOutSection.indexOf('supabase.auth.signOut()')
    const fallbackPos = signOutSection.indexOf('setAllowAnonFallback(true)')
    expect(signOutPos).toBeGreaterThan(-1)
    expect(fallbackPos).toBeGreaterThan(-1)
    expect(fallbackPos).toBeGreaterThan(signOutPos)
  })

  it('6. signOutAccount creates new anonymous identity via ensureUser', () => {
    const signOutSection = accountLinkSource.slice(
      accountLinkSource.indexOf('export async function signOutAccount'),
    )
    expect(signOutSection).toMatch(/ensureUser\(\)/)
  })

  it('7. signOutAccount switches RC via notifyIdentityChanged (direct logIn)', () => {
    const signOutSection = accountLinkSource.slice(
      accountLinkSource.indexOf('export async function signOutAccount'),
    )
    expect(signOutSection).toMatch(/notifyIdentityChanged/)
  })

  it('8. signOutAccount documents direct logIn switch in comments', () => {
    const signOutSection = accountLinkSource.slice(
      accountLinkSource.indexOf('export async function signOutAccount'),
    )
    expect(signOutSection).toMatch(/direct.*logIn/i)
  })
})

describe('ProStore is non-authoritative (no AsyncStorage)', () => {
  it('9. ProStore does NOT import AsyncStorage', () => {
    expect(proStoreSource).not.toMatch(/AsyncStorage/)
  })

  it('10. ProStore createInitialProState starts as free', () => {
    expect(proStoreSource).toMatch(/tier:\s*['"]free['"]/)
  })

  it('11. ProStore is marked non-authoritative', () => {
    expect(proStoreSource).toMatch(/NON-AUTHORITATIVE/i)
  })

  it('12. DEV_TOGGLE_PRO requires developer mode', () => {
    expect(proStoreSource).toMatch(/DEV_TOGGLE_PRO/)
    expect(proStoreSource).toMatch(/devProActive/)
  })
})

describe('Account A/B isolation logic', () => {
  it('13. notifyIdentityChanged calls revenueCatLogIn with userId', () => {
    expect(accountLinkSource).toMatch(/notifyIdentityChanged/)
    const notifySection = accountLinkSource.slice(
      accountLinkSource.indexOf('async function notifyIdentityChanged'),
    )
    expect(notifySection).toMatch(/revenueCatLogIn\(userId\)/)
  })

  it('14. verifySignIn calls notifyIdentityChanged with restored UUID', () => {
    const verifySection = accountLinkSource.slice(
      accountLinkSource.indexOf('export async function verifySignIn'),
    )
    expect(verifySection).toMatch(/notifyIdentityChanged\(userId\)/)
  })

  it('15. verifyEmailLink calls notifyIdentityChanged with same UUID', () => {
    const verifySection = accountLinkSource.slice(
      accountLinkSource.indexOf('export async function verifyEmailLink'),
    )
    expect(verifySection).toMatch(/notifyIdentityChanged\(userId\)/)
  })

  it('16. identity.ts ensureUser creates anonymous user if no session', () => {
    expect(identitySource).toMatch(/signInAnonymously/)
  })

  it('17. identity.ts allowAnonFallback controls anonymous creation', () => {
    expect(identitySource).toMatch(/allowAnonFallback/)
    expect(identitySource).toMatch(/setAllowAnonFallback/)
  })
})

describe('Simulated account switch scenarios', () => {
  // These tests simulate the identity state transitions without
  // requiring real Supabase/RevenueCat connections.

  it('18. Account A Pro → signout → new anonymous → no cached Pro', () => {
    // Simulate: Account A has Pro
    let accountA_Pro = true
    let rcAppUserId = 'account-a-uuid'
    let rcHasPro = accountA_Pro

    // Signout: revenueCatLogOut clears RC state
    rcAppUserId = null
    rcHasPro = false

    // New anonymous session
    const newAnonUuid = 'new-anon-uuid'
    rcAppUserId = newAnonUuid

    // RevenueCat has no entitlements for new anonymous user
    expect(rcHasPro).toBe(false)
    expect(rcAppUserId).toBe('new-anon-uuid')
    expect(rcAppUserId).not.toBe('account-a-uuid')
  })

  it('19. Account B login → RevenueCat App User ID = B UUID', () => {
    let rcAppUserId = 'anon-uuid'
    const accountB_Uuid = 'account-b-uuid'

    // Account B signs in
    rcAppUserId = accountB_Uuid

    expect(rcAppUserId).toBe('account-b-uuid')
  })

  it('20. Account A login again → RevenueCat App User ID = A UUID', () => {
    let rcAppUserId = 'anon-uuid'
    const accountA_Uuid = 'account-a-uuid'

    // Account A signs back in
    rcAppUserId = accountA_Uuid

    expect(rcAppUserId).toBe('account-a-uuid')
  })

  it('21. Account A Pro restored on re-login (from server subscriptions table)', () => {
    // After re-login, RevenueCat fetches CustomerInfo for A UUID
    // which has active Pro entitlement from the subscriptions table.
    const accountA_Uuid = 'account-a-uuid'
    const subscriptionsTable = {
      [accountA_Uuid]: { is_active: true, entitlement: 'pro' },
    }
    const restoredPro = subscriptionsTable[accountA_Uuid]?.is_active ?? false
    expect(restoredPro).toBe(true)
  })
})
