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
import { analyzeScanOnServer, isServerScanAvailable } from './quota/quotaService'
import type { ScanQuotaSnapshot } from './subscriptions/subscriptionTypes'

const MAX_IMAGE_BASE64_CHARS = 1_400_000
const TARGET_LONG_EDGE = 1024
const TARGET_QUALITY = 0.7
const RETRY_LONG_EDGE = 768
const RETRY_QUALITY = 0.5

// ── Types ────────────────────────────────────────────────────

export interface IdentifiedProduce {
  produceId: string
  name: string
  count: number
  estimatedWeightG: number
  confidence: number // 0–1
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
// Resize and compress the captured image before base64 encoding
// to ensure the final payload stays below the server's
// MAX_IMAGE_BASE64_CHARS limit (1.5M chars ≈ 1.1MB binary).
// We target 1.4M chars as a safety margin.

export class ImageProcessingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageProcessingError'
  }
}

interface PreprocessResult {
  base64: string
  width: number
  height: number
}

async function resizeAndCompress(
  imageUri: string,
  longEdge: number,
  quality: number,
): Promise<PreprocessResult> {
  const result = await manipulateAsync(imageUri, [{ resize: { width: longEdge } }], {
    compress: quality,
    format: SaveFormat.JPEG,
    base64: true,
  })
  const base64 = result.base64 || ''
  if (!base64) {
    throw new ImageProcessingError('Image preprocessing returned no data')
  }
  return {
    base64,
    width: result.width,
    height: result.height,
  }
}

export async function preprocessImage(
  imageUri: string,
  originalWidth?: number,
  originalHeight?: number,
): Promise<PreprocessResult> {
  const origW = originalWidth ?? 0
  const origH = originalHeight ?? 0
  const origDims = origW > 0 && origH > 0 ? `${origW}x${origH}` : 'unknown'

  let attempt = 1
  let longEdge = TARGET_LONG_EDGE
  let quality = TARGET_QUALITY

  let result = await resizeAndCompress(imageUri, longEdge, quality)

  console.debug(
    `[image-preprocess] attempt=${attempt} origDims=${origDims} ` +
      `resizedDims=${result.width}x${result.height} ` +
      `base64Len=${result.base64.length}`,
  )

  if (result.base64.length > MAX_IMAGE_BASE64_CHARS) {
    attempt = 2
    longEdge = RETRY_LONG_EDGE
    quality = RETRY_QUALITY

    result = await resizeAndCompress(imageUri, longEdge, quality)

    console.debug(
      `[image-preprocess] attempt=${attempt} origDims=${origDims} ` +
        `resizedDims=${result.width}x${result.height} ` +
        `base64Len=${result.base64.length}`,
    )
  }

  if (result.base64.length > MAX_IMAGE_BASE64_CHARS) {
    throw new ImageProcessingError(
      'Unable to reduce image size within acceptable limits. Please try again with different lighting.',
    )
  }

  return result
}

// ── API Call ─────────────────────────────────────────────────

export async function identifyProduce(
  imageUri: string,
  mediaType: string = 'image/jpeg',
  depthDataMm: number[] | null = null,
  originalWidth?: number,
  originalHeight?: number,
): Promise<VisionResult> {
  const hasDepth = depthDataMm !== null && depthDataMm.length > 0

  if (!isServerScanAvailable()) {
    throw new Error('Scan service is not configured. Please check your connection and try again.')
  }

  const { base64 } = await preprocessImage(imageUri, originalWidth, originalHeight)

  const { rawText, quota } = await analyzeScanOnServer(
    base64,
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

function parseVisionResponse(rawText: string, hasDepthData: boolean): VisionResult {
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
  const scannedIngredients: ScannedIngredient[] = items.map((item) => ({
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
