// ─────────────────────────────────────────────────────────────
// ClaudeVisionService.ts — Produce identification via Supabase
//
// Sends a camera-captured image (base64) to the Supabase
// analyze-scan Edge Function, which calls the Anthropic API
// server-side. The Anthropic API key never enters the client.
// ─────────────────────────────────────────────────────────────

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

  // All scans go through the Supabase analyze-scan Edge Function,
  // which keeps the Anthropic API key server-side.
  if (!isServerScanAvailable()) {
    throw new Error(
      'Server scan is not available. Ensure Supabase is configured.'
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
