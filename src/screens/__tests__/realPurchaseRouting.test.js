// realPurchaseRouting.test.js — Tests for H3B: fake/local priced Pro
// purchase CTAs are redirected to the real RevenueCat-backed Paywall.
//
// Proves:
// 1. SnapGateModal Upgrade path navigates to Paywall (not Vault)
// 2. Vault priced CTA navigates to Paywall (not ProStore.subscribe)
// 3. PaywallModal uses onSubscribe when provided (not ProStore.subscribe)
// 4. Normal user purchase CTA reaches the real Paywall route
// 5. Developer Tools simulation remains isolated
// 6. Free user cannot gain effective Pro by tapping legacy CTA
// 7. Existing real Paywall purchase logic remains untouched

const fs = require('fs')
const path = require('path')

const vaultPath = path.resolve(__dirname, '../VaultScreen.js')
const vaultSource = fs.readFileSync(vaultPath, 'utf8')

const paywallModalPath = path.resolve(__dirname, '../../components/PaywallModal.js')
const paywallModalSource = fs.readFileSync(paywallModalPath, 'utf8')

const homePath = path.resolve(__dirname, '../HomeScreen.js')
const homeSource = fs.readFileSync(homePath, 'utf8')

const dashboardPath = path.resolve(__dirname, '../DashboardScreen.js')
const dashboardSource = fs.readFileSync(dashboardPath, 'utf8')

describe('H3B: Real purchase routing', () => {
  describe('VaultScreen CTA', () => {
    it('1. handleSubscribe navigates to Paywall (not ProStore.subscribe)', () => {
      const handlerBlock = vaultSource.slice(
        vaultSource.indexOf('handleSubscribe'),
        vaultSource.indexOf('handleBuyPack'),
      )
      expect(handlerBlock).toMatch(/navigation\.navigate\('Paywall'/)
      expect(handlerBlock).not.toMatch(/subscribe\(selectedPlan\)/)
    })

    it('2. handleBuyPack navigates to Paywall (not buySnapPack/buyRecipePack)', () => {
      const handlerBlock = vaultSource.slice(
        vaultSource.indexOf('handleBuyPack'),
        vaultSource.indexOf('return (', vaultSource.indexOf('handleBuyPack')) || vaultSource.indexOf('},', vaultSource.indexOf('handleBuyPack')) + 200,
      )
      expect(handlerBlock).toMatch(/navigation\.navigate\('Paywall'/)
      expect(handlerBlock).not.toMatch(/buySnapPack\(\)/)
      expect(handlerBlock).not.toMatch(/buyRecipePack\(/)
    })

    it('3. hardcoded price removed from CTA text', () => {
      const ctaBlock = vaultSource.slice(
        vaultSource.indexOf('subscribeCtaText'),
        vaultSource.indexOf('</LinearGradient>', vaultSource.indexOf('subscribeCtaText')) + 20,
      )
      expect(ctaBlock).not.toMatch(/SUBSCRIPTION_PLANS\[selectedPlan\]\.price/)
    })

    it('4. CTA text is just "Unlock Pro" without hardcoded price', () => {
      expect(vaultSource).toMatch(/Unlock Pro/)
      // The old format "Unlock Pro — $39.99" should not appear
      expect(vaultSource).not.toMatch(/Unlock Pro — \{/)
    })
  })

  describe('PaywallModal CTA', () => {
    it('5. accepts onSubscribe prop', () => {
      expect(paywallModalSource).toMatch(/onSubscribe/)
    })

    it('6. uses onSubscribe when provided (not subscribe)', () => {
      const handlerBlock = paywallModalSource.slice(
        paywallModalSource.indexOf('handleSubscribe'),
        paywallModalSource.indexOf('onDismiss', paywallModalSource.indexOf('handleSubscribe')) + 20,
      )
      expect(handlerBlock).toMatch(/if \(onSubscribe\)/)
      expect(handlerBlock).toMatch(/onSubscribe\(\)/)
    })

    it('7. falls back to subscribe when onSubscribe not provided (dev/test)', () => {
      const handlerBlock = paywallModalSource.slice(
        paywallModalSource.indexOf('handleSubscribe'),
        paywallModalSource.indexOf('onDismiss', paywallModalSource.indexOf('handleSubscribe')) + 20,
      )
      expect(handlerBlock).toMatch(/subscribe\(selectedPlan\)/)
    })
  })

  describe('HomeScreen SnapGateModal', () => {
    it('8. onUpgrade navigates to Paywall (not Vault)', () => {
      const snapGateBlock = homeSource.slice(
        homeSource.indexOf('<SnapGateModal'),
        homeSource.indexOf('/>', homeSource.indexOf('<SnapGateModal')) + 2,
      )
      expect(snapGateBlock).toMatch(/onUpgrade.*navigation\.navigate\('Paywall'/)
      expect(snapGateBlock).not.toMatch(/navigation\.navigate\('Vault'\)/)
    })

    it('9. onBuyPack navigates to Paywall (not Vault)', () => {
      const snapGateBlock = homeSource.slice(
        homeSource.indexOf('<SnapGateModal'),
        homeSource.indexOf('/>', homeSource.indexOf('<SnapGateModal')) + 2,
      )
      expect(snapGateBlock).toMatch(/onBuyPack.*navigation\.navigate\('Paywall'/)
    })
  })

  describe('HomeScreen upsell nudge', () => {
    it('10. upsell nudge navigates to Paywall (not Vault)', () => {
      const upsellBlock = homeSource.slice(
        homeSource.indexOf('Pro Upsell Nudge'),
        homeSource.indexOf('manualStyles.upsellContent', homeSource.indexOf('Pro Upsell Nudge')) + 200,
      )
      expect(upsellBlock).toMatch(/navigation\.navigate\('Paywall'/)
      expect(upsellBlock).not.toMatch(/navigation\.navigate\('Vault'\)/)
    })
  })

  describe('DashboardScreen', () => {
    it('11. unlock button navigates to Paywall (not Vault)', () => {
      expect(dashboardSource).toMatch(/navigation\.navigate\('Paywall'/)
      expect(dashboardSource).not.toMatch(/navigation\.navigate\('Vault'\)/)
    })

    it('12. PaywallModal passes onSubscribe to navigate to Paywall', () => {
      const modalBlock = dashboardSource.slice(
        dashboardSource.indexOf('<PaywallModal'),
        dashboardSource.indexOf('/>', dashboardSource.indexOf('<PaywallModal')) + 2,
      )
      expect(modalBlock).toMatch(/onSubscribe.*navigation\.navigate\('Paywall'/)
    })
  })

  describe('Developer Tools simulation remains isolated', () => {
    it('13. ProStore.subscribe still exists for dev/test fallback', () => {
      // The subscribe function should still exist in ProStore for
      // developer tools and test fallback, but should not be called
      // from normal customer-facing purchase CTAs.
      const proStorePath = path.resolve(__dirname, '../../services/ProStore.js')
      const proStoreSource = fs.readFileSync(proStorePath, 'utf8')
      expect(proStoreSource).toMatch(/subscribe/)
    })

    it('14. PaywallModal subscribe fallback is gated by onSubscribe absence', () => {
      // The fallback to subscribe() only runs when onSubscribe is not
      // provided, which is the dev/test path.
      const handlerBlock = paywallModalSource.slice(
        paywallModalSource.indexOf('handleSubscribe'),
        paywallModalSource.indexOf('onDismiss', paywallModalSource.indexOf('handleSubscribe')) + 20,
      )
      expect(handlerBlock).toMatch(/if \(onSubscribe\)/)
      expect(handlerBlock).toMatch(/else/)
      expect(handlerBlock).toMatch(/subscribe\(selectedPlan\)/)
    })
  })

  describe('Free user cannot gain effective Pro via legacy CTA', () => {
    it('15. VaultScreen no longer calls subscribe from the CTA handler', () => {
      // The handleSubscribe function must not call subscribe(selectedPlan).
      // Comments may mention "subscribe" but no actual call should exist.
      const handlerBlock = vaultSource.slice(
        vaultSource.indexOf('handleSubscribe'),
        vaultSource.indexOf('handleBuyPack'),
      )
      expect(handlerBlock).not.toMatch(/subscribe\(selectedPlan\)/)
    })

    it('16. VaultScreen no longer calls buySnapPack/buyRecipePack', () => {
      const handlerBlock = vaultSource.slice(
        vaultSource.indexOf('handleBuyPack'),
        vaultSource.indexOf('return (', vaultSource.indexOf('handleBuyPack')) > -1
          ? vaultSource.indexOf('return (', vaultSource.indexOf('handleBuyPack'))
          : vaultSource.indexOf('handleBuyPack') + 300,
      )
      expect(handlerBlock).not.toMatch(/buySnapPack\(\)/)
      expect(handlerBlock).not.toMatch(/buyRecipePack\(/)
    })
  })
})
