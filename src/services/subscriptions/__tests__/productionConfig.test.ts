// ─────────────────────────────────────────────────────────────
// productionConfig.test.ts — Tests for build-time and runtime
// production configuration validation.
//
// Verifies the distinction between:
//   BUILD MISCONFIGURATION → production startup blocked
//   TEMPORARY SERVICE FAILURE → app remains usable
// ─────────────────────────────────────────────────────────────

import { validateProductionConfig } from '../productionConfig'

// Mock Platform
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}))

// Mock subscriptionConfig with controllable values
const mockConfig = {
  MONETIZATION_ENABLED: true,
  REVENUECAT_PUBLIC_API_KEY: 'goog_validkey123456789',
  SUPABASE_URL: 'https://twnkxajnoeljgerqgqep.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bmt4YWpub2VsamdlcnFncWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMDcxODEsImV4cCI6MjA5OTU4MzE4MX0.G2Ofc3ZNXsR_DOh_eMSKX3sXu8nIjukj4f6Ua2Bp53o',
}

jest.mock('../subscriptionConfig', () => ({
  get MONETIZATION_ENABLED () { return mockConfig.MONETIZATION_ENABLED },
  get REVENUECAT_PUBLIC_API_KEY () { return mockConfig.REVENUECAT_PUBLIC_API_KEY },
  get SUPABASE_URL () { return mockConfig.SUPABASE_URL },
  get SUPABASE_ANON_KEY () { return mockConfig.SUPABASE_ANON_KEY },
}))

// Mock process.env for the monetization flag check
// Use bracket access to avoid babel react-native-dotenv transforms
const envHolder: { EXPO_PUBLIC_MONETIZATION_ENABLED?: string } = {}

describe('productionConfig', () => {
  beforeEach(() => {
    // Set up globalThis.process.env mock for the readMonetizationEnvFlag helper
    const g = globalThis as Record<string, unknown>
    if (!g.process) g.process = { env: {} }
    const proc = g.process as { env: Record<string, string | undefined> }
    if (!proc.env) proc.env = {}
    // Save original
    envHolder.EXPO_PUBLIC_MONETIZATION_ENABLED = proc.env.EXPO_PUBLIC_MONETIZATION_ENABLED
    proc.env.EXPO_PUBLIC_MONETIZATION_ENABLED = 'true'
  })

  afterEach(() => {
    // Reset mocks
    mockConfig.MONETIZATION_ENABLED = true
    mockConfig.REVENUECAT_PUBLIC_API_KEY = 'goog_validkey123456789'
    mockConfig.SUPABASE_URL = 'https://twnkxajnoeljgerqgqep.supabase.co'
    mockConfig.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bmt4YWpub2VsamdlcnFncWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMDcxODEsImV4cCI6MjA5OTU4MzE4MX0.G2Ofc3ZNXsR_DOh_eMSKX3sXu8nIjukj4f6Ua2Bp53o'
    const g = globalThis as Record<string, unknown>
    const proc = g.process as { env: Record<string, string | undefined> }
    if (envHolder.EXPO_PUBLIC_MONETIZATION_ENABLED !== undefined) {
      proc.env.EXPO_PUBLIC_MONETIZATION_ENABLED = envHolder.EXPO_PUBLIC_MONETIZATION_ENABLED
    } else {
      delete proc.env.EXPO_PUBLIC_MONETIZATION_ENABLED
    }
  })

  describe('validateProductionConfig (production mode)', () => {
    it('passes when all required config is present and valid', () => {
      const g = globalThis as Record<string, unknown>
      const proc = g.process as { env: Record<string, string | undefined> }
      proc.env['EXPO_PUBLIC_MONETIZATION_ENABLED'] = 'true'
      const result = validateProductionConfig(true)
      expect(result.ok).toBe(true)
      expect(result.missing).toHaveLength(0)
    })

    it('fails when Supabase URL is missing', () => {
      mockConfig.SUPABASE_URL = ''
      const result = validateProductionConfig(true)
      expect(result.ok).toBe(false)
      expect(result.missing.some(c => c.key === 'EXPO_PUBLIC_SUPABASE_URL')).toBe(true)
    })

    it('fails when Supabase URL is not a supabase.co URL', () => {
      mockConfig.SUPABASE_URL = 'https://example.com'
      const result = validateProductionConfig(true)
      expect(result.ok).toBe(false)
      expect(result.missing.some(c => c.key === 'EXPO_PUBLIC_SUPABASE_URL')).toBe(true)
    })

    it('fails when Supabase URL is not HTTPS', () => {
      mockConfig.SUPABASE_URL = 'http://twnkxajnoeljgerqgqep.supabase.co'
      const result = validateProductionConfig(true)
      expect(result.ok).toBe(false)
      expect(result.missing.some(c => c.key === 'EXPO_PUBLIC_SUPABASE_URL')).toBe(true)
    })

    it('fails when Supabase anon key is missing', () => {
      mockConfig.SUPABASE_ANON_KEY = ''
      const result = validateProductionConfig(true)
      expect(result.ok).toBe(false)
      expect(result.missing.some(c => c.key === 'EXPO_PUBLIC_SUPABASE_ANON_KEY')).toBe(true)
    })

    it('fails when Supabase anon key is not a JWT', () => {
      mockConfig.SUPABASE_ANON_KEY = 'not-a-jwt'
      const result = validateProductionConfig(true)
      expect(result.ok).toBe(false)
      expect(result.missing.some(c => c.key === 'EXPO_PUBLIC_SUPABASE_ANON_KEY')).toBe(true)
    })

    it('fails when RevenueCat key is missing', () => {
      mockConfig.REVENUECAT_PUBLIC_API_KEY = ''
      const result = validateProductionConfig(true)
      expect(result.ok).toBe(false)
      expect(result.missing.some(c => c.key === 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY')).toBe(true)
    })

    it('fails when RevenueCat key is a placeholder', () => {
      mockConfig.REVENUECAT_PUBLIC_API_KEY = 'appl_your-public-ios-key'
      const result = validateProductionConfig(true)
      expect(result.ok).toBe(false)
      expect(result.missing.some(c => c.key === 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY')).toBe(true)
    })

    it('fails when RevenueCat key has wrong prefix for Android', () => {
      mockConfig.REVENUECAT_PUBLIC_API_KEY = 'appl_validkey123456789'
      const result = validateProductionConfig(true)
      expect(result.ok).toBe(false)
      expect(result.missing.some(c => c.key === 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY')).toBe(true)
    })

    it('fails when MONETIZATION_ENABLED is not set', () => {
      const g = globalThis as Record<string, unknown>
      const proc = g.process as { env: Record<string, string | undefined> }
      delete proc.env['EXPO_PUBLIC_MONETIZATION_ENABLED']
      const result = validateProductionConfig(true)
      expect(result.ok).toBe(false)
      expect(result.missing.some(c => c.key === 'EXPO_PUBLIC_MONETIZATION_ENABLED')).toBe(true)
    })

    it('fails when MONETIZATION_ENABLED is an invalid value', () => {
      const g = globalThis as Record<string, unknown>
      const proc = g.process as { env: Record<string, string | undefined> }
      proc.env['EXPO_PUBLIC_MONETIZATION_ENABLED'] = 'maybe'
      const result = validateProductionConfig(true)
      expect(result.ok).toBe(false)
      expect(result.missing.some(c => c.key === 'EXPO_PUBLIC_MONETIZATION_ENABLED')).toBe(true)
    })
  })

  describe('validateProductionConfig (development mode)', () => {
    it('passes even when required values are missing (dev allows free mode)', () => {
      mockConfig.SUPABASE_URL = ''
      mockConfig.SUPABASE_ANON_KEY = ''
      mockConfig.REVENUECAT_PUBLIC_API_KEY = ''
      const result = validateProductionConfig(false)
      // In dev, missing values are not "required" failures
      expect(result.missing).toHaveLength(0)
    })
  })

  describe('fail-closed behavior', () => {
    it('never grants Pro from missing config', () => {
      mockConfig.SUPABASE_URL = ''
      mockConfig.SUPABASE_ANON_KEY = ''
      mockConfig.REVENUECAT_PUBLIC_API_KEY = ''
      const result = validateProductionConfig(true)
      // Missing config → blocked, not bypassed
      expect(result.ok).toBe(false)
    })
  })
})
