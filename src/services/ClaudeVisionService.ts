// ─────────────────────────────────────────────────────────────
// ClaudeVisionService.ts — Produce identification via Supabase
//
// Routes camera-captured images through the Supabase analyze-scan
// Edge Function, which calls Anthropic server-side. The mobile app
// never reads or stores an Anthropic API key.
// ─────────────────────────────────────────────────────────────

import type { ScannedIngredient } from './JuiceEngine'
import { PRODUCE_DATA } from './JuiceEngine'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import {
  analyzeScanOnServer,
  isServerScanAvailable,
} from './quota/quotaService'
import type { ScanQuotaSnapshot } from './subscriptions/subscriptionTypes'

// ── Types ────────────────────────────────────────────────────

export interface IdentifiedProduce {
  produceId: string
  name: string
  count: number
  estimatedWeightG: number
  confidence: number   // 0–1
}

export interface VisionResult {
  items: IdentifiedProduce[]
  scannedIngredients: ScannedIngredient[]
  rawResponse: string
  hasDepthData: boolean
  // Present when the scan went through the server-authoritative
  // quota path — lets the UI update its usage meter immediately.
  quota?: ScanQuotaSnapshot | null
}

function createRequestId(): string {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

// ── Image Pre-processing ────────────────────────────────────
// Resize to 768px long edge at 70% JPEG quality to reduce
// payload size and API latency

export async function preprocessImage(
  imageUri: string,
): Promise<{ base64: string; width: number; height: number }> {
  const result = await manipulateAsync(
    imageUri,
    [{ resize: { width: 768 } }],
    { compress: 0.7, format: SaveFormat.JPEG, base64: true }
  )
  return {
    base64: result.base64 || '',
    width: result.width,
    height: result.height,
  }
}

// ── API Call ─────────────────────────────────────────────────

export async function identifyProduce(
  imageBase64: string,
  mediaType: string = 'image/jpeg',
  depthDataMm: number[] | null = null,
): Promise<VisionResult> {
  const hasDepth = depthDataMm !== null && depthDataMm.length > 0

  if (!isServerScanAvailable()) {
    throw new Error(
      'Scan service is not configured. Please check your connection and try again.'
    )
  }

  const { rawText, quota } = await analyzeScanOnServer(
    imageBase64,
    mediaType,
    createRequestId(),
    depthDataMm,
  )
  const result = parseVisionResponse(rawText, hasDepth)
  return { ...result, quota }
}

// ── Response Parser ──────────────────────────────────────────

// Build a lowercase name → produceId lookup for fallback matching
const NAME_TO_ID: Record<string, string> = {}
for (const [pid, entry] of Object.entries(PRODUCE_DATA)) {
  NAME_TO_ID[entry.name.toLowerCase()] = pid
}

function resolveProduceId(rawId: string, name: string): string | null {
  const id = rawId.toLowerCase().trim()
  if (id && PRODUCE_DATA[id]) return id
  const lowerName = name.toLowerCase().trim()
  if (lowerName && NAME_TO_ID[lowerName]) return NAME_TO_ID[lowerName]
  return null
}

function parseVisionResponse(
  rawText: string,
  hasDepthData: boolean,
): VisionResult {
  let items: IdentifiedProduce[] = []

  try {
    // Strip any accidental markdown fences
    const cleaned = rawText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    if (!Array.isArray(parsed)) {
      throw new Error('Expected JSON array')
    }

    items = parsed.map((item: Record<string, unknown>) => ({
      produceId: String(item.produceId ?? 'unknown').toLowerCase(),
      name: String(item.name ?? 'Unknown'),
      count: Number(item.count ?? 1),
      estimatedWeightG: Number(item.estimatedWeightG ?? 0),
      confidence: Math.min(1, Math.max(0, Number(item.confidence ?? 0.5))),
    }))
  } catch {
    console.warn('Failed to parse Claude vision response:', rawText)
    items = []
  }

  // Validate each item against the produce catalog. Attempt
  // produceId match first, then name-based fallback. Items that
  // cannot be resolved to a catalog entry are dropped so they
  // never reach the UI or nutrient engine.
  const validated: IdentifiedProduce[] = []
  for (const item of items) {
    const resolvedId = resolveProduceId(item.produceId, item.name)
    if (resolvedId) {
      validated.push({
        ...item,
        produceId: resolvedId,
        name: PRODUCE_DATA[resolvedId].name,
      })
    } else {
      console.warn('[SCAN] unmapped produce item dropped:', item.produceId, item.name)
    }
  }
  items = validated

  // Convert to ScannedIngredient format for the JuiceEngine
  const scannedIngredients: ScannedIngredient[] = items
    .map((item) => ({
      produceId: item.produceId,
      weightG: item.estimatedWeightG,
    }))

  return {
    items,
    scannedIngredients,
    rawResponse: rawText,
    hasDepthData,
  }
}
