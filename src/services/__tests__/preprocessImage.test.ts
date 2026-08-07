import { preprocessImage, ImageProcessingError } from '../ClaudeVisionService'

jest.mock('../subscriptions/subscriptionConfig', () => ({
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_CONFIGURED: true,
  MONETIZATION_ENABLED: true,
  FREE_MONTHLY_SCAN_LIMIT: 5,
  PRO_MONTHLY_SCAN_LIMIT: 60,
  PRO_DAILY_SCAN_SAFETY_LIMIT: 10,
  FREE_WARNING_THRESHOLDS: [2, 1],
  PRO_WARNING_THRESHOLDS: [10, 5],
  REVENUECAT_PUBLIC_API_KEY: 'goog_test',
  PRO_ENTITLEMENT_ID: 'pro',
  DEFAULT_OFFERING_ID: 'default',
  APPLE_PRODUCT_IDS: { monthly: 'm', annual: 'a' },
  GOOGLE_SUBSCRIPTION_ID: 'sub',
  GOOGLE_BASE_PLANS: { monthly: 'm', annual: 'a' },
  TERMS_URL: null,
  PRIVACY_URL: null,
}))

jest.mock('../supabase/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => null,
}))

jest.mock('../supabase/identity', () => ({
  getAccessToken: jest.fn().mockResolvedValue('test-token'),
  getUserId: jest.fn().mockResolvedValue('test-user'),
  setAllowAnonFallback: jest.fn(),
}))

jest.mock('../JuiceEngine', () => ({
  PRODUCE_DATA: {},
}))

jest.mock('../quota/quotaService', () => ({
  analyzeScanOnServer: jest.fn(),
  isServerScanAvailable: () => true,
}))

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}))

const { manipulateAsync } = jest.requireMock('expo-image-manipulator')

function mockResult(base64: string, width: number, height: number) {
  return Promise.resolve({ base64, uri: 'file://mock', width, height })
}

function makeBase64(len: number): string {
  return 'A'.repeat(len)
}

describe('preprocessImage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('1. large portrait image is resized', async () => {
    const smallB64 = makeBase64(1000)
    manipulateAsync.mockImplementation(
      (_uri: string, actions: { resize?: { width?: number } }[]) => {
        const w = actions[0]?.resize?.width ?? 1024
        return mockResult(smallB64, w, Math.round(w * 1.5))
      },
    )

    const result = await preprocessImage('file://photo.jpg', 4032, 3024)

    expect(manipulateAsync).toHaveBeenCalledWith(
      'file://photo.jpg',
      [{ resize: { width: 1024 } }],
      expect.objectContaining({ compress: 0.7, format: 'jpeg', base64: true }),
    )
    expect(result.base64).toBe(smallB64)
    expect(result.width).toBe(1024)
  })

  it('2. large landscape image is resized', async () => {
    const smallB64 = makeBase64(1000)
    manipulateAsync.mockImplementation(
      (_uri: string, actions: { resize?: { width?: number } }[]) => {
        const w = actions[0]?.resize?.width ?? 1024
        return mockResult(smallB64, w, Math.round(w * 0.75))
      },
    )

    const result = await preprocessImage('file://photo.jpg', 3024, 4032)

    expect(result.width).toBe(1024)
    expect(result.height).toBe(768)
  })

  it('3. aspect ratio is preserved (resize uses width as long edge)', async () => {
    manipulateAsync.mockResolvedValue(mockResult(makeBase64(500), 1024, 768))

    await preprocessImage('file://photo.jpg', 4032, 3024)

    expect(manipulateAsync).toHaveBeenCalledWith(
      'file://photo.jpg',
      [{ resize: { width: 1024 } }],
      expect.any(Object),
    )
  })

  it('5. final dimensions are capped at target long edge', async () => {
    manipulateAsync.mockResolvedValue(mockResult(makeBase64(500), 1024, 768))

    const result = await preprocessImage('file://photo.jpg', 4032, 3024)

    expect(result.width).toBeLessThanOrEqual(1024)
  })

  it('6. final compressed base64 is below the target limit', async () => {
    const okB64 = makeBase64(500000)
    manipulateAsync.mockResolvedValue(mockResult(okB64, 1024, 768))

    const result = await preprocessImage('file://photo.jpg', 4032, 3024)

    expect(result.base64.length).toBeLessThan(1_400_000)
  })

  it('7. oversized first result retries with lower dimensions or quality', async () => {
    const bigB64 = makeBase64(2_000_000)
    const smallB64 = makeBase64(800000)

    manipulateAsync
      .mockResolvedValueOnce(mockResult(bigB64, 1024, 768))
      .mockResolvedValueOnce(mockResult(smallB64, 768, 576))

    const result = await preprocessImage('file://photo.jpg', 4032, 3024)

    expect(manipulateAsync).toHaveBeenCalledTimes(2)
    expect(manipulateAsync).toHaveBeenNthCalledWith(
      2,
      'file://photo.jpg',
      [{ resize: { width: 768 } }],
      expect.objectContaining({ compress: 0.5 }),
    )
    expect(result.base64).toBe(smallB64)
  })

  it('8. a bounded second result proceeds', async () => {
    const bigB64 = makeBase64(2_000_000)
    const okB64 = makeBase64(600000)

    manipulateAsync
      .mockResolvedValueOnce(mockResult(bigB64, 1024, 768))
      .mockResolvedValueOnce(mockResult(okB64, 768, 576))

    const result = await preprocessImage('file://photo.jpg', 4032, 3024)

    expect(result.base64.length).toBeLessThan(1_400_000)
  })

  it('9. preprocessing failure throws ImageProcessingError before network request', async () => {
    manipulateAsync.mockRejectedValue(new Error('native decode failed'))

    await expect(preprocessImage('file://photo.jpg', 4032, 3024)).rejects.toThrow()
  })

  it('throws ImageProcessingError when both attempts exceed limit', async () => {
    const bigB641 = makeBase64(2_000_000)
    const bigB642 = makeBase64(1_800_000)

    manipulateAsync
      .mockResolvedValueOnce(mockResult(bigB641, 1024, 768))
      .mockResolvedValueOnce(mockResult(bigB642, 768, 576))

    await expect(preprocessImage('file://photo.jpg', 4032, 3024)).rejects.toThrow(
      ImageProcessingError,
    )
  })

  it('throws ImageProcessingError when base64 is empty', async () => {
    manipulateAsync.mockResolvedValue(mockResult('', 1024, 768))

    await expect(preprocessImage('file://photo.jpg', 4032, 3024)).rejects.toThrow(
      ImageProcessingError,
    )
  })

  it('13. small images are not unnecessarily enlarged beyond target', async () => {
    const smallB64 = makeBase64(500)
    manipulateAsync.mockResolvedValue(mockResult(smallB64, 1024, 768))

    const result = await preprocessImage('file://photo.jpg', 800, 600)

    expect(result.width).toBeLessThanOrEqual(1024)
  })

  it('logs sanitized preprocessing info without image data', async () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation()
    manipulateAsync.mockResolvedValue(mockResult(makeBase64(500), 1024, 768))

    await preprocessImage('file://photo.jpg', 4032, 3024)

    const calls = debugSpy.mock.calls.map((c) => String(c[0]))
    expect(calls.some((c) => c.includes('[image-preprocess]'))).toBe(true)
    expect(calls.some((c) => c.includes('attempt=1'))).toBe(true)
    expect(calls.some((c) => c.includes('base64Len='))).toBe(true)
    expect(calls.every((c) => !c.includes('file://'))).toBe(true)

    debugSpy.mockRestore()
  })
})
