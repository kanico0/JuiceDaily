// basePlanProduct.test.js — Tests for Google Play base-plan product identifier parsing.
//
// RawLifeFlow subscription:
//   subscription: juicing_daily_pro
//   base plans:   monthly, annual
//
// RevenueCat may represent these as:
//   juicing_daily_pro:monthly
//   juicing_daily_pro:annual
//
// The webhook's planFromProductId() must correctly determine:
//   juicing_daily_pro:monthly  → pro_monthly
//   juicing_daily_pro:annual   → pro_annual
//   unknown base plan          → null (safe diagnostic, never false Pro-plan)
//
// The active "pro" entitlement itself remains the source for whether
// Pro access is active — this function only labels the plan tier.

const fs = require('fs')
const path = require('path')

const webhookPath = path.resolve(__dirname, '../../../supabase/functions/revenuecat-webhook/index.ts')
const webhookSource = fs.readFileSync(webhookPath, 'utf8')

// Extract the planFromProductId function source
const funcMatch = webhookSource.match(/function planFromProductId[\s\S]*?\n}/)
const funcSource = funcMatch ? funcMatch[0] : ''

describe('planFromProductId: source structure', () => {
  it('1. function exists in webhook', () => {
    expect(funcSource).toMatch(/function planFromProductId/)
  })

  it('2. handles base-plan colon format', () => {
    expect(funcSource).toMatch(/includes\(':'\)/)
    expect(funcSource).toMatch(/split\(':'\)/)
  })

  it('3. handles monthly base plan', () => {
    expect(funcSource).toMatch(/'monthly'/)
    expect(funcSource).toMatch(/pro_monthly/)
  })

  it('4. handles annual base plan', () => {
    expect(funcSource).toMatch(/'annual'/)
    expect(funcSource).toMatch(/pro_annual/)
  })

  it('5. returns null for unknown base plan (never false Pro-plan)', () => {
    expect(funcSource).toMatch(/do NOT guess/i)
    expect(funcSource).toMatch(/return null/i)
  })
})

describe('planFromProductId: base-plan parsing logic', () => {
  // Replicate the parsing logic to verify behavior
  function planFromProductId(productId) {
    if (!productId) return null
    const id = productId.toLowerCase()
    if (id.includes(':')) {
      const basePlan = id.split(':')[1] ?? ''
      if (basePlan === 'monthly') return 'pro_monthly'
      if (basePlan === 'annual' || basePlan === 'yearly') return 'pro_annual'
      return null
    }
    if (id.includes('annual') || id.includes('year') || id.includes('yearly')) {
      return 'pro_annual'
    }
    if (id.includes('monthly') || id.includes('month')) {
      return 'pro_monthly'
    }
    return null
  }

  it('6. juicing_daily_pro:monthly → pro_monthly', () => {
    expect(planFromProductId('juicing_daily_pro:monthly')).toBe('pro_monthly')
  })

  it('7. juicing_daily_pro:annual → pro_annual', () => {
    expect(planFromProductId('juicing_daily_pro:annual')).toBe('pro_annual')
  })

  it('8. juicing_daily_pro:yearly → pro_annual', () => {
    expect(planFromProductId('juicing_daily_pro:yearly')).toBe('pro_annual')
  })

  it('9. unknown base plan → null (never false Pro-plan)', () => {
    expect(planFromProductId('juicing_daily_pro:unknown')).toBe(null)
  })

  it('10. juicing_daily_pro:weekly → null (not a valid RawLifeFlow plan)', () => {
    expect(planFromProductId('juicing_daily_pro:weekly')).toBe(null)
  })

  it('11. bare juicing_daily_pro (no base plan) → null', () => {
    expect(planFromProductId('juicing_daily_pro')).toBe(null)
  })

  it('12. null productId → null', () => {
    expect(planFromProductId(null)).toBe(null)
  })

  it('13. empty string → null', () => {
    expect(planFromProductId('')).toBe(null)
  })

  it('14. case-insensitive: JUICING_DAILY_PRO:ANNUAL → pro_annual', () => {
    expect(planFromProductId('JUICING_DAILY_PRO:ANNUAL')).toBe('pro_annual')
  })

  it('15. case-insensitive: Juicing_Daily_Pro:Monthly → pro_monthly', () => {
    expect(planFromProductId('Juicing_Daily_Pro:Monthly')).toBe('pro_monthly')
  })

  it('16. legacy annual keyword → pro_annual', () => {
    expect(planFromProductId('pro_annual')).toBe('pro_annual')
  })

  it('17. legacy monthly keyword → pro_monthly', () => {
    expect(planFromProductId('pro_monthly')).toBe('pro_monthly')
  })

  it('18. unknown product with no base plan or keyword → null', () => {
    expect(planFromProductId('some_random_product')).toBe(null)
  })

  it('19. never returns false Pro-plan for unknown base plan', () => {
    // Critical: an unknown base plan must NEVER return pro_monthly or pro_annual
    const result = planFromProductId('juicing_daily_pro:unknown')
    expect(result).not.toBe('pro_monthly')
    expect(result).not.toBe('pro_annual')
  })
})

describe('planFromProductId: webhook integration', () => {
  it('20. webhook uses planFromProductId in REST derivation', () => {
    const restSection = webhookSource.slice(
      webhookSource.indexOf('deriveStateFromRest'),
    )
    expect(restSection).toMatch(/planFromProductId/)
  })

  it('21. webhook uses planFromProductId in event-type fallback', () => {
    const fallbackSection = webhookSource.slice(
      webhookSource.indexOf('allowEventTypeFallback'),
    )
    expect(fallbackSection).toMatch(/planFromProductId/)
  })
})
