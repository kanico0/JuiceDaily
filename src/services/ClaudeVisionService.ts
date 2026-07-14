// ─────────────────────────────────────────────────────────────
// ClaudeVisionService.ts — Claude 3.5 Sonnet produce identification
//
// Sends a camera-captured image (base64) to the Anthropic API.
// Returns a structured list of identified produce items with
// estimated counts and weights.
// ─────────────────────────────────────────────────────────────

import { PRODUCE_DATA } from './JuiceEngine'
import type { ScannedIngredient } from './JuiceEngine'
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

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: ClaudeContent[]
}

interface ClaudeContent {
  type: 'text' | 'image'
  text?: string
  source?: {
    type: 'base64'
    media_type: string
    data: string
  }
}

// ── Config ───────────────────────────────────────────────────
// IMPORTANT: Store your API key in environment variables or a
// secure config. Never commit it to source control.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-20250514'

let apiKey: string | null = null

export function setClaudeApiKey(key: string): void {
  apiKey = key
  console.log('[ClaudeVision] API key set — present:', !!key, 'len:', key?.length ?? 0)
}

export function isClaudeKeySet(): boolean {
  return isServerScanAvailable() || (!!apiKey && apiKey.length > 10)
}

function createRequestId(): string {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

// ── Known produce IDs for the prompt ─────────────────────────

const KNOWN_IDS = Object.keys(PRODUCE_DATA)

// ── System prompt ────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a produce identification expert. Return ONLY a valid JSON array, no markdown, no explanation.
For each produce item: {"produceId":"<id>","name":"<name>","count":<n>,"estimatedWeightG":<g>,"confidence":<0-1>}
Valid IDs: ${KNOWN_IDS.join(',')}
Standard weights: carrot~70g, celery~40g, kale~30g, apple~180g, ginger~15g, cucumber~200g, beet~130g, lemon~60g, spinach~30g, pineapple~900g`

const SYSTEM_PROMPT_WITH_DEPTH = `You are a produce identification expert for a cold-pressed juicing app called "Juicing".

Analyze the photo and the accompanying LiDAR depth data to identify all visible produce items. The depth data provides real-world dimensions in millimeters, enabling more accurate volume and weight estimation.

For each item return:
- "produceId": one of these exact IDs: ${KNOWN_IDS.join(', ')}. If the item doesn't match any known ID, use the closest match or "unknown".
- "name": human-readable name
- "count": how many of this item you see
- "estimatedWeightG": estimated total weight in grams using the depth dimensions for volumetric calculation. Apply standard produce densities:
  - Carrot: ~1.04 g/cm3
  - Celery: ~0.95 g/cm3
  - Kale: ~0.30 g/cm3 (leafy)
  - Apple: ~0.85 g/cm3
  - Ginger: ~1.07 g/cm3
  - Cucumber: ~0.96 g/cm3
  - Beet: ~1.05 g/cm3
  - Lemon: ~0.95 g/cm3
  - Spinach: ~0.25 g/cm3 (leafy)
  - Pineapple: ~0.88 g/cm3
- "confidence": 0 to 1

Return ONLY a valid JSON array. No markdown, no explanation.`

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

  // Preferred path: server-authoritative scan through Supabase.
  // The server enforces quota (reserve → vision → commit/release)
  // and keeps the Anthropic key off the device.
  if (isServerScanAvailable()) {
    const { rawText, quota } = await analyzeScanOnServer(
      imageBase64,
      mediaType,
      createRequestId(),
      depthDataMm,
    )
    const result = parseVisionResponse(rawText, hasDepth)
    return { ...result, quota }
  }

  // Dev/Expo Go fallback: direct Anthropic call with a local key.
  if (!apiKey) {
    throw new Error(
      'Claude API key not set. Call setClaudeApiKey() before using the vision service.'
    )
  }

  const hasDepthData = depthDataMm !== null && depthDataMm.length > 0

  const userContent: ClaudeContent[] = [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: imageBase64,
      },
    },
    {
      type: 'text',
      text: hasDepthData
        ? `Identify all produce in this image. LiDAR depth data (mm): [${depthDataMm!.slice(0, 100).join(',')}${depthDataMm!.length > 100 ? '...' : ''}]. Use depth for volumetric weight estimation.`
        : 'Identify all produce items in this image. Estimate count and weight for each.',
    },
  ]

  const messages: ClaudeMessage[] = [
    { role: 'user', content: userContent },
  ]

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 150,
      system: hasDepthData ? SYSTEM_PROMPT_WITH_DEPTH : SYSTEM_PROMPT,
      messages,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    const safeMsg = response.status === 401
      ? 'Authentication failed — check your ANTHROPIC_API_KEY in .env'
      : response.status === 429
      ? 'Rate limit exceeded — please wait a moment'
      : `API error (${response.status})`
    console.warn('[ClaudeVision] Request failed:', response.status, safeMsg)
    throw new Error(safeMsg)
  }

  const data = await response.json()
  const rawText: string = data.content?.[0]?.text ?? '[]'

  return parseVisionResponse(rawText, hasDepthData)
}

// ── Response Parser ──────────────────────────────────────────

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

  // Convert to ScannedIngredient format for the JuiceEngine
  const scannedIngredients: ScannedIngredient[] = items
    .filter((item) => item.produceId !== 'unknown')
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
