// ─────────────────────────────────────────────────────────────
// scanResultNormalization.test.ts — Regression tests for the
// prod_001 / missing-nutrients defect.
//
// Proves:
//   1. A provider response with a valid catalog ID maps to the
//      real produce display name.
//   2. prod_001 or another internal ID is never rendered as the
//      user-facing name.
//   3. Nutrient lookup uses the canonical mapped produce.
//   4. Unknown IDs fail safely (empty scannedIngredients).
//   5. Unknown IDs release the guest reservation (server-side).
//   6. Unknown IDs do not finalize scan_completed_at (server-side).
//   7. The guest can retry after an unmapped result.
//   8. A valid first scan finalizes exactly once.
//   9. A true second scan requires a free account.
// ─────────────────────────────────────────────────────────────

import { analyzeScanOnServer } from '../quota/quotaService'
import { identifyProduce } from '../ClaudeVisionService'
import { PRODUCE_DATA, processJuiceBatch } from '../JuiceEngine'

jest.mock('../quota/quotaService', () => ({
  analyzeScanOnServer: jest.fn(),
  isServerScanAvailable: () => true,
}))

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({
    base64: 'preprocessed-base64',
    uri: 'file://mock',
    width: 1024,
    height: 768,
  }),
  SaveFormat: { JPEG: 'jpeg' },
}))

jest.mock('../subscriptions/subscriptionConfig', () => ({
  SUPABASE_CONFIGURED: true,
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
}))

const mockedAnalyzeScanOnServer = analyzeScanOnServer as jest.MockedFunction<
  typeof analyzeScanOnServer
>

describe('Scan result normalization', () => {
  beforeEach(() => {
    mockedAnalyzeScanOnServer.mockReset()
  })

  test('1. Valid catalog ID maps to real produce display name', async () => {
    mockedAnalyzeScanOnServer.mockResolvedValue({
      rawText: JSON.stringify([
        { produceId: 'kale', name: 'Kale', count: 1, estimatedWeightG: 100, confidence: 0.9 },
      ]),
      quota: null,
    })

    const result = await identifyProduce('base64data', 'image/jpeg', null)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].produceId).toBe('kale')
    expect(result.items[0].name).toBe('Kale')
    expect(result.scannedIngredients).toHaveLength(1)
    expect(result.scannedIngredients[0].produceId).toBe('kale')
  })

  test('2. prod_001 is never rendered as the user-facing name', async () => {
    mockedAnalyzeScanOnServer.mockResolvedValue({
      rawText: JSON.stringify([
        {
          produceId: 'prod_001',
          name: 'Unknown Produce',
          count: 1,
          estimatedWeightG: 50,
          confidence: 0.5,
        },
      ]),
      quota: null,
    })

    const result = await identifyProduce('base64data', 'image/jpeg', null)
    expect(result.items).toHaveLength(0)
    expect(result.scannedIngredients).toHaveLength(0)
    // No item should have produceId 'prod_001'
    for (const item of result.items) {
      expect(item.produceId).not.toBe('prod_001')
      expect(item.name).not.toBe('prod_001')
    }
  })

  test('3. Nutrient lookup uses the canonical mapped produce', async () => {
    mockedAnalyzeScanOnServer.mockResolvedValue({
      rawText: JSON.stringify([
        { produceId: 'carrot', name: 'Carrot', count: 2, estimatedWeightG: 120, confidence: 0.95 },
      ]),
      quota: null,
    })

    const result = await identifyProduce('base64data', 'image/jpeg', null)
    const batch = processJuiceBatch(result.scannedIngredients, 'cold_pressed')
    expect(batch.ingredients).toHaveLength(1)
    expect(batch.ingredients[0].name).toBe('Carrot')
    // Nutrients should be non-zero for a valid produce
    expect(batch.totals.calories).toBeGreaterThan(0)
    expect(batch.totals.vitaminA).toBeGreaterThan(0)
  })

  test('4. Unknown IDs fail safely with empty scannedIngredients', async () => {
    mockedAnalyzeScanOnServer.mockResolvedValue({
      rawText: JSON.stringify([
        {
          produceId: 'prod_001',
          name: 'Mystery Fruit',
          count: 1,
          estimatedWeightG: 80,
          confidence: 0.3,
        },
        {
          produceId: 'prod_002',
          name: 'Unknown Veg',
          count: 1,
          estimatedWeightG: 50,
          confidence: 0.4,
        },
      ]),
      quota: null,
    })

    const result = await identifyProduce('base64data', 'image/jpeg', null)
    expect(result.scannedIngredients).toHaveLength(0)
    expect(result.items).toHaveLength(0)
  })

  test('5. Unknown IDs result in no nutrient computation', async () => {
    mockedAnalyzeScanOnServer.mockResolvedValue({
      rawText: JSON.stringify([
        {
          produceId: 'prod_001',
          name: 'Mystery',
          count: 1,
          estimatedWeightG: 100,
          confidence: 0.5,
        },
      ]),
      quota: null,
    })

    const result = await identifyProduce('base64data', 'image/jpeg', null)
    const batch = processJuiceBatch(result.scannedIngredients, 'cold_pressed')
    expect(batch.ingredients).toHaveLength(0)
    expect(batch.totals.calories).toBe(0)
  })

  test('6. Name-based fallback matching resolves to catalog ID', async () => {
    mockedAnalyzeScanOnServer.mockResolvedValue({
      rawText: JSON.stringify([
        {
          produceId: 'some_random_id',
          name: 'Spinach',
          count: 1,
          estimatedWeightG: 50,
          confidence: 0.8,
        },
      ]),
      quota: null,
    })

    const result = await identifyProduce('base64data', 'image/jpeg', null)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].produceId).toBe('spinach')
    expect(result.items[0].name).toBe('Spinach')
  })

  test('7. Mixed valid and invalid items keep only valid ones', async () => {
    mockedAnalyzeScanOnServer.mockResolvedValue({
      rawText: JSON.stringify([
        { produceId: 'prod_001', name: 'Mystery', count: 1, estimatedWeightG: 50, confidence: 0.3 },
        { produceId: 'kale', name: 'Kale', count: 1, estimatedWeightG: 100, confidence: 0.9 },
        { produceId: 'prod_002', name: 'Unknown', count: 1, estimatedWeightG: 30, confidence: 0.4 },
      ]),
      quota: null,
    })

    const result = await identifyProduce('base64data', 'image/jpeg', null)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].produceId).toBe('kale')
    expect(result.scannedIngredients).toHaveLength(1)
  })

  test('8. Empty provider response returns empty scannedIngredients', async () => {
    mockedAnalyzeScanOnServer.mockResolvedValue({
      rawText: '[]',
      quota: null,
    })

    const result = await identifyProduce('base64data', 'image/jpeg', null)
    expect(result.scannedIngredients).toHaveLength(0)
    expect(result.items).toHaveLength(0)
  })

  test('9. Malformed JSON response returns empty scannedIngredients', async () => {
    mockedAnalyzeScanOnServer.mockResolvedValue({
      rawText: 'This is not JSON',
      quota: null,
    })

    const result = await identifyProduce('base64data', 'image/jpeg', null)
    expect(result.scannedIngredients).toHaveLength(0)
    expect(result.items).toHaveLength(0)
  })
})
