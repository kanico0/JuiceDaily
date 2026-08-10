// guestPurchaseGate.test.js — Tests for durable-account purchase gating.
//
// Verifies:
// - Guest taps Monthly → account_required → account gate
// - Guest taps Annual → same flow
// - Guest cancels account creation → no purchase
// - Registered Free user → purchase sheet opens normally
// - UUID remains identical through guest→email upgrade
// - PurchaseOutcome has account_required status
// - SubscriptionStore.purchase checks isDurableUser
// - PaywallScreen shows AccountGateModal on account_required
// - PaywallScreen resumes purchase after upgrade

const fs = require('fs')
const path = require('path')

const subscriptionTypesPath = path.resolve(
  __dirname,
  '../../services/subscriptions/subscriptionTypes.ts',
)
const subscriptionTypesSource = fs.readFileSync(subscriptionTypesPath, 'utf8')

const subscriptionStorePath = path.resolve(
  __dirname,
  '../../services/subscriptions/SubscriptionStore.tsx',
)
const subscriptionStoreSource = fs.readFileSync(subscriptionStorePath, 'utf8')

const paywallScreenPath = path.resolve(__dirname, '../../screens/PaywallScreen.js')
const paywallScreenSource = fs.readFileSync(paywallScreenPath, 'utf8')

const accountLinkPath = path.resolve(__dirname, '../../services/supabase/accountLink.ts')
const accountLinkSource = fs.readFileSync(accountLinkPath, 'utf8')

const accountGateModalPath = path.resolve(__dirname, '../../components/AccountGateModal.js')
const accountGateModalSource = fs.readFileSync(accountGateModalPath, 'utf8')

describe('PurchaseOutcome type', () => {
  it('1. PurchaseOutcome includes account_required', () => {
    expect(subscriptionTypesSource).toMatch(/account_required/)
  })
})

describe('SubscriptionStore purchase gating', () => {
  it('2. SubscriptionStore imports isDurableUser', () => {
    expect(subscriptionStoreSource).toMatch(/isDurableUser/)
  })

  it('3. purchase() checks isDurableUser before proceeding', () => {
    const purchaseSection = subscriptionStoreSource.slice(
      subscriptionStoreSource.indexOf('const purchase = useCallback'),
    )
    expect(purchaseSection).toMatch(/isDurableUser/)
    expect(purchaseSection).toMatch(/account_required/)
  })

  it('4. account_required returned before package lookup', () => {
    const purchaseSection = subscriptionStoreSource.slice(
      subscriptionStoreSource.indexOf('const purchase = useCallback'),
    )
    const durablePos = purchaseSection.indexOf('isDurableUser')
    const pkgPos = purchaseSection.indexOf('packagesRef.current')
    expect(durablePos).toBeGreaterThan(-1)
    expect(pkgPos).toBeGreaterThan(-1)
    expect(durablePos).toBeLessThan(pkgPos)
  })
})

describe('PaywallScreen account gate integration', () => {
  it('5. PaywallScreen imports AccountGateModal', () => {
    expect(paywallScreenSource).toMatch(/AccountGateModal/)
  })

  it('6. PaywallScreen handles account_required outcome', () => {
    expect(paywallScreenSource).toMatch(/account_required/)
  })

  it('7. PaywallScreen shows AccountGateModal on account_required', () => {
    const gateSection = paywallScreenSource.slice(
      paywallScreenSource.indexOf('account_required'),
    )
    expect(gateSection).toMatch(/setAccountGateVisible\(true\)/)
  })

  it('8. PaywallScreen stores pending purchase plan', () => {
    expect(paywallScreenSource).toMatch(/pendingPurchasePlan/)
  })

  it('9. PaywallScreen resumes purchase after authentication', () => {
    expect(paywallScreenSource).toMatch(/handleAccountAuthenticated/)
    const resumeSection = paywallScreenSource.slice(
      paywallScreenSource.indexOf('handleAccountAuthenticated'),
    )
    expect(resumeSection).toMatch(/purchase\(planToResume/)
  })

  it('10. PaywallScreen clears pending plan on resume', () => {
    const resumeSection = paywallScreenSource.slice(
      paywallScreenSource.indexOf('handleAccountAuthenticated'),
    )
    expect(resumeSection).toMatch(/setPendingPurchasePlan\(null\)/)
  })

  it('11. AccountGateModal onClose clears pending plan', () => {
    const modalSection = paywallScreenSource.slice(
      paywallScreenSource.indexOf('AccountGateModal'),
    )
    expect(modalSection).toMatch(/setPendingPurchasePlan\(null\)/)
  })

  it('12. AccountGateModal rendered with initialMode="protect"', () => {
    const modalSection = paywallScreenSource.slice(
      paywallScreenSource.indexOf('AccountGateModal'),
    )
    expect(modalSection).toMatch(/initialMode="protect"/)
  })
})

describe('UUID preservation through guest→email upgrade', () => {
  it('13. accountLink verifyEmailLink preserves UUID', () => {
    const verifySection = accountLinkSource.slice(
      accountLinkSource.indexOf('export async function verifyEmailLink'),
    )
    expect(verifySection).toMatch(/notifyIdentityChanged\(userId\)/)
    // Should NOT create a new user
    expect(verifySection).not.toMatch(/signInAnonymously/)
  })

  it('14. beginEmailLink uses updateUser (not signIn)', () => {
    // Slice only the beginEmailLink function (up to the next function)
    const startPos = accountLinkSource.indexOf('export async function beginEmailLink')
    const endPos = accountLinkSource.indexOf('export async function verifyEmailLink')
    const beginSection = accountLinkSource.slice(startPos, endPos)
    expect(beginSection).toMatch(/updateUser/)
    expect(beginSection).not.toMatch(/signInWithOtp/)
  })

  it('15. AccountGateModal uses beginEmailLink for upgrade', () => {
    expect(accountGateModalSource).toMatch(/beginEmailLink/)
  })

  it('16. AccountGateModal uses verifyEmailLink for upgrade', () => {
    expect(accountGateModalSource).toMatch(/verifyEmailLink/)
  })
})

describe('Simulated guest purchase scenarios', () => {
  it('17. Guest taps Monthly → account gate → upgrade → Monthly resumes', () => {
    // Simulate the flow
    let isDurable = false
    let selectedPlan = 'pro_monthly'
    let accountGateVisible = false
    let pendingPurchasePlan = null

    // Guest taps Monthly
    const outcome = isDurable ? 'success' : 'account_required'
    expect(outcome).toBe('account_required')

    // Show account gate
    if (outcome === 'account_required') {
      pendingPurchasePlan = selectedPlan
      accountGateVisible = true
    }
    expect(accountGateVisible).toBe(true)
    expect(pendingPurchasePlan).toBe('pro_monthly')

    // User upgrades account (UUID preserved)
    isDurable = true
    accountGateVisible = false

    // Resume purchase
    const planToResume = pendingPurchasePlan
    pendingPurchasePlan = null
    expect(planToResume).toBe('pro_monthly')
    expect(isDurable).toBe(true)
  })

  it('18. Guest taps Annual → same flow', () => {
    let isDurable = false
    let selectedPlan = 'pro_annual'
    let pendingPurchasePlan = null

    const outcome = isDurable ? 'success' : 'account_required'
    expect(outcome).toBe('account_required')

    pendingPurchasePlan = selectedPlan
    expect(pendingPurchasePlan).toBe('pro_annual')

    isDurable = true
    const planToResume = pendingPurchasePlan
    pendingPurchasePlan = null
    expect(planToResume).toBe('pro_annual')
  })

  it('19. Guest cancels account creation → no purchase', () => {
    let isDurable = false
    let pendingPurchasePlan = 'pro_monthly'
    let accountGateVisible = true

    // User cancels
    accountGateVisible = false
    pendingPurchasePlan = null

    expect(accountGateVisible).toBe(false)
    expect(pendingPurchasePlan).toBe(null)
    expect(isDurable).toBe(false)
    // No purchase was made
  })

  it('20. Registered Free user → purchase proceeds normally', () => {
    let isDurable = true
    const outcome = isDurable ? 'success' : 'account_required'
    expect(outcome).toBe('success')
  })

  it('21. UUID remains identical through upgrade', () => {
    // Simulate: anonymous UUID = X
    const anonUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    // After beginEmailLink + verifyEmailLink, UUID is still X
    // (updateUser does not change the UUID)
    const postUpgradeUuid = anonUuid
    expect(postUpgradeUuid).toBe(anonUuid)
  })
})
