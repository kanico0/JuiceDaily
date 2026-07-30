// ─────────────────────────────────────────────────────────────
// producePortionConversion.ts
//
// Pure, deterministic, offline conversion service that translates
// quantity-based portion selections into estimated raw weight in
// grams using the sourced produce portion registry.
//
// This service does NOT:
//   - import or invoke JuiceEngine / processJuiceBatch
//   - apply yield percentages
//   - apply organic multipliers
//   - apply nutrition retention factors
//   - call any network or quota service
//
// The output (estimatedRawWeightG) is intended to be used as the
// canonical `weightG` field on a ScannedIngredient, after which the
// existing JuiceEngine processes it exactly as it does for direct
// weight entry.
// ─────────────────────────────────────────────────────────────

import {
  PRODUCE_PORTIONS,
  type ProducePortionRecord,
  type PortionUnit,
  type PortionSize,
  type Confidence,
} from '../constants/producePortions'

// ── Constants ────────────────────────────────────────────────

/** Exact USDA/NIST conversion factor: 1 oz = 28.349523125 g */
export const GRAMS_PER_OZ = 28.349523125

/** Stable registry/source version derived from the official manifest. */
export const REGISTRY_SOURCE_VERSION = 'manifest-2.0'

// ── Result Types ─────────────────────────────────────────────

export type ConversionErrorCode =
  | 'unknown_produce'
  | 'quantity_not_supported'
  | 'invalid_quantity'
  | 'unknown_unit'
  | 'size_required'
  | 'unknown_size'
  | 'decimal_not_allowed'
  | 'invalid_step'

export interface ConversionSuccess {
  ok: true
  produceId: string
  quantity: number
  unitKey: string
  sizeKey: string | null
  gramsPerUnit: number
  estimatedRawWeightG: number
  estimatedRawWeightOz: number
  confidence: Confidence
  sourceVersion: string
  sourceDescription: string
  displayDescription: string
}

export interface ConversionFailure {
  ok: false
  errorCode: ConversionErrorCode
  message: string
}

export type ConversionResult = ConversionSuccess | ConversionFailure

// ── Metadata Types (Phase 2) ─────────────────────────────────

export type PortionEntryMode = 'weight' | 'quantity'

export interface QuantityPortionMetadata {
  inputMode: 'quantity'
  enteredQuantity: number
  unitKey: string
  sizeKey: string | null
  estimatedRawWeightG: number
  sourceVersion: string
  wasEstimateOverridden: boolean
  originalEstimatedRawWeightG: number
}

export interface WeightPortionMetadata {
  inputMode: 'weight'
}

export type PortionMetadata = QuantityPortionMetadata | WeightPortionMetadata

// ── Registry Lookup Functions ────────────────────────────────

export function getPortionRegistryRecord(produceId: string): ProducePortionRecord | null {
  const record = PRODUCE_PORTIONS[produceId]
  return record ?? null
}

export function isQuantitySupported(produceId: string): boolean {
  const record = getPortionRegistryRecord(produceId)
  if (!record) return false
  return record.quantitySupported
}

export function getSupportedPortionUnits(produceId: string): readonly PortionUnit[] {
  const record = getPortionRegistryRecord(produceId)
  if (!record) return []
  return record.units
}

export function getDefaultPortionUnit(produceId: string): PortionUnit | null {
  const record = getPortionRegistryRecord(produceId)
  if (!record || !record.quantitySupported || !record.defaultUnitKey) return null
  const unit = record.units.find((u) => u.unitKey === record.defaultUnitKey)
  return unit ?? null
}

export function getSupportedSizes(produceId: string, unitKey: string): readonly PortionSize[] {
  const record = getPortionRegistryRecord(produceId)
  if (!record) return []
  const unit = record.units.find((u) => u.unitKey === unitKey)
  if (!unit) return []
  return unit.sizes
}

// ── Validation ───────────────────────────────────────────────

export interface QuantityPortionInput {
  produceId: string
  quantity: number
  unitKey: string
  sizeKey?: string | null
}

export function validateQuantityPortionInput(input: QuantityPortionInput): ConversionFailure | null {
  const record = getPortionRegistryRecord(input.produceId)
  if (!record) {
    return {
      ok: false,
      errorCode: 'unknown_produce',
      message: `Unknown produce ID: "${input.produceId}"`,
    }
  }

  if (!record.quantitySupported) {
    return {
      ok: false,
      errorCode: 'quantity_not_supported',
      message: `Quantity entry is not supported for "${input.produceId}" — use weight only.`,
    }
  }

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return {
      ok: false,
      errorCode: 'invalid_quantity',
      message: `Quantity must be a finite number greater than zero (got ${input.quantity}).`,
    }
  }

  const unit = record.units.find((u) => u.unitKey === input.unitKey)
  if (!unit) {
    return {
      ok: false,
      errorCode: 'unknown_unit',
      message: `Unknown unit key "${input.unitKey}" for produce "${input.produceId}".`,
    }
  }

  if (!unit.allowDecimal && !Number.isInteger(input.quantity)) {
    return {
      ok: false,
      errorCode: 'decimal_not_allowed',
      message: `Unit "${unit.unitKey}" requires integer quantities (got ${input.quantity}).`,
    }
  }

  if (unit.inputStep > 0 && unit.inputStep !== 1) {
    const steps = input.quantity / unit.inputStep
    const tolerance = 1e-9
    if (Math.abs(steps - Math.round(steps)) > tolerance) {
      return {
        ok: false,
        errorCode: 'invalid_step',
        message: `Quantity ${input.quantity} is not a valid multiple of step ${unit.inputStep} for unit "${unit.unitKey}".`,
      }
    }
  }

  const hasSML = unit.sizes.some((s) => s.sizeKey !== 'standard')
  const sizeKey = input.sizeKey ?? null

  if (hasSML && !sizeKey) {
    return {
      ok: false,
      errorCode: 'size_required',
      message: `Unit "${unit.unitKey}" requires a size key (small, medium, or large).`,
    }
  }

  if (sizeKey) {
    const size = unit.sizes.find((s) => s.sizeKey === sizeKey)
    if (!size) {
      return {
        ok: false,
        errorCode: 'unknown_size',
        message: `Unknown size key "${sizeKey}" for unit "${unit.unitKey}" on produce "${input.produceId}".`,
      }
    }
  }

  return null
}

// ── Conversion ───────────────────────────────────────────────

export function estimateRawWeightGrams(input: QuantityPortionInput): ConversionResult {
  const validationError = validateQuantityPortionInput(input)
  if (validationError) return validationError

  const record = getPortionRegistryRecord(input.produceId)!
  const unit = record.units.find((u) => u.unitKey === input.unitKey)!
  const hasSML = unit.sizes.some((s) => s.sizeKey !== 'standard')
  const sizeKey = input.sizeKey ?? null

  let size: PortionSize
  if (hasSML && sizeKey) {
    size = unit.sizes.find((s) => s.sizeKey === sizeKey)!
  } else {
    size = unit.sizes[0]
  }

  const gramsPerUnit = size.gramWeight
  const estimatedRawWeightG = input.quantity * gramsPerUnit
  const estimatedRawWeightOz = estimatedRawWeightG / GRAMS_PER_OZ

  const sourceRecord = record.sourceRecords[0]
  const sourceDescription = sourceRecord
    ? sourceRecord.sourcePortionDescription
    : 'No source description available'

  const isSingular = input.quantity === 1
  const label = isSingular ? unit.displaySingular : unit.displayPlural
  const sizeLabel = size.sizeKey !== 'standard' ? size.displaySize : ''
  const displayDescription = sizeLabel
    ? `${input.quantity} ${label} (${sizeLabel})`
    : `${input.quantity} ${label}`

  return {
    ok: true,
    produceId: input.produceId,
    quantity: input.quantity,
    unitKey: input.unitKey,
    sizeKey: sizeKey,
    gramsPerUnit,
    estimatedRawWeightG,
    estimatedRawWeightOz,
    confidence: record.confidence,
    sourceVersion: REGISTRY_SOURCE_VERSION,
    sourceDescription,
    displayDescription,
  }
}

export function estimateRawWeightOz(input: QuantityPortionInput): ConversionResult {
  const result = estimateRawWeightGrams(input)
  if (!result.ok) return result
  return result
}

export function formatQuantityDescription(input: QuantityPortionInput): string {
  const result = estimateRawWeightGrams(input)
  if (!result.ok) return ''
  return result.displayDescription
}

// ── Metadata Helper Functions (Phase 2) ──────────────────────

export function createQuantityMetadata(
  input: QuantityPortionInput,
): QuantityPortionMetadata | null {
  const result = estimateRawWeightGrams(input)
  if (!result.ok) return null

  return {
    inputMode: 'quantity',
    enteredQuantity: result.quantity,
    unitKey: result.unitKey,
    sizeKey: result.sizeKey,
    estimatedRawWeightG: result.estimatedRawWeightG,
    sourceVersion: result.sourceVersion,
    wasEstimateOverridden: false,
    originalEstimatedRawWeightG: result.estimatedRawWeightG,
  }
}

export function applyManualWeightOverride(
  metadata: QuantityPortionMetadata,
  correctedWeightG: number,
): { weightG: number; metadata: QuantityPortionMetadata } {
  return {
    weightG: correctedWeightG,
    metadata: {
      ...metadata,
      estimatedRawWeightG: correctedWeightG,
      wasEstimateOverridden: true,
    },
  }
}

export function recomputeFromQuantityChange(
  input: QuantityPortionInput,
): { weightG: number; metadata: QuantityPortionMetadata } | null {
  const metadata = createQuantityMetadata(input)
  if (!metadata) return null
  return {
    weightG: metadata.estimatedRawWeightG,
    metadata,
  }
}

export function restoreQuantityMetadata(
  metadata: QuantityPortionMetadata,
): { weightG: number; metadata: QuantityPortionMetadata } {
  return {
    weightG: metadata.estimatedRawWeightG,
    metadata: {
      ...metadata,
      wasEstimateOverridden: false,
    },
  }
}
