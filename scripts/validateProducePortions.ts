/**
 * Produce Portion Registry Validator
 *
 * Validates the PRODUCE_PORTIONS registry against PRODUCE_DATA from JuiceEngine.
 * Run with: npx tsx scripts/validateProducePortions.ts
 *
 * Validation checks:
 *  1. Coverage — every PRODUCE_DATA key has a PRODUCE_PORTIONS entry
 *  2. Uniqueness — no duplicate produceId keys in registry
 *  3. No extras — registry has no keys not in PRODUCE_DATA
 *  4. Source metadata — every record has at least one sourceRecord
 *  5. Positive finite gram weights — all gramWeight values are > 0 and finite
 *  6. Size ordering — small < medium < large where multiple sizes exist
 *  7. Default unit resolution — defaultUnitKey exists in units[] (or null for weight-only)
 *  8. No fluid-ounce values — no source mentions fluid ounces
 *  9. No raw/cooked mismatch — all preparationState must contain "raw"
 * 10. Integer input step — allowDecimal=false requires inputStep=1
 * 11. Decimal input step — allowDecimal=true requires inputStep < 1 or inputStep=1
 * 12. Immutability — PRODUCE_PORTIONS is frozen
 * 13. Unit key uniqueness — no duplicate unitKey within a record
 * 14. Size key uniqueness — no duplicate sizeKey within a unit
 * 15. Confidence valid — must be 'high', 'medium', or 'low'
 * 16. Authority valid — must be 'USDA', 'FDA', or 'peer-reviewed'
 * 17. Quantity-supported consistency — quantitySupported=true requires units.length > 0
 * 18. Weight-only consistency — quantitySupported=false requires units.length === 0
 */

import { PRODUCE_PORTIONS } from '../src/constants/producePortions'
import { PRODUCE_DATA } from '../src/services/JuiceEngine'

interface ValidationError {
  check: string
  produceId: string
  message: string
}

const errors: ValidationError[] = []
const warnings: ValidationError[] = []

const produceDataKeys = Object.keys(PRODUCE_DATA)
const portionKeys = Object.keys(PRODUCE_PORTIONS)

// 1. Coverage
for (const key of produceDataKeys) {
  if (!(key in PRODUCE_PORTIONS)) {
    errors.push({ check: 'coverage', produceId: key, message: 'Missing from PRODUCE_PORTIONS' })
  }
}

// 2. Uniqueness (automatic with object keys, but check for duplicates in source)
const seenKeys = new Set<string>()
for (const key of portionKeys) {
  if (seenKeys.has(key)) {
    errors.push({ check: 'uniqueness', produceId: key, message: 'Duplicate key in registry' })
  }
  seenKeys.add(key)
}

// 3. No extras
for (const key of portionKeys) {
  if (!(key in PRODUCE_DATA)) {
    errors.push({ check: 'no-extras', produceId: key, message: 'Key in registry but not in PRODUCE_DATA' })
  }
}

// 4–18. Per-record checks
for (const [pid, record] of Object.entries(PRODUCE_PORTIONS)) {
  // 4. Source metadata
  if (!record.sourceRecords || record.sourceRecords.length === 0) {
    errors.push({ check: 'source-metadata', produceId: pid, message: 'No sourceRecords' })
  }

  // 5. Positive finite gram weights
  for (const unit of record.units) {
    for (const size of unit.sizes) {
      if (!(size.gramWeight > 0) || !Number.isFinite(size.gramWeight)) {
        errors.push({ check: 'gram-weight', produceId: pid, message: `Invalid gramWeight ${size.gramWeight} for unit ${unit.unitKey} size ${size.sizeKey}` })
      }
    }
  }

  // 6. Size ordering
  for (const unit of record.units) {
    const sizes = unit.sizes
    const sizeOrder: Record<string, number> = { small: 0, medium: 1, large: 2, standard: -1 }
    for (let i = 1; i < sizes.length; i++) {
      const prev = sizes[i - 1]
      const curr = sizes[i]
      if (sizeOrder[prev.sizeKey] >= 0 && sizeOrder[curr.sizeKey] >= 0) {
        if (sizeOrder[prev.sizeKey] >= sizeOrder[curr.sizeKey]) {
          errors.push({ check: 'size-ordering', produceId: pid, message: `Size ${prev.sizeKey} should come before ${curr.sizeKey} in unit ${unit.unitKey}` })
        }
        if (prev.gramWeight >= curr.gramWeight) {
          errors.push({ check: 'size-ordering', produceId: pid, message: `${prev.sizeKey} gramWeight (${prev.gramWeight}) should be < ${curr.sizeKey} gramWeight (${curr.gramWeight}) in unit ${unit.unitKey}` })
        }
      }
    }
  }

  // 7. Default unit resolution
  if (record.defaultUnitKey !== null) {
    const found = record.units.find((u) => u.unitKey === record.defaultUnitKey)
    if (!found) {
      errors.push({ check: 'default-unit', produceId: pid, message: `defaultUnitKey "${record.defaultUnitKey}" not found in units` })
    }
  }

  // 8. No fluid-ounce values
  for (const sr of record.sourceRecords) {
    if (/fluid\s*ounce|fl\s*oz/i.test(sr.sourcePortionDescription) || /fluid\s*ounce|fl\s*oz/i.test(sr.citationText)) {
      errors.push({ check: 'no-fluid-ounce', produceId: pid, message: 'Source mentions fluid ounces' })
    }
  }

  // 9. No raw/cooked mismatch
  for (const sr of record.sourceRecords) {
    if (!/raw/i.test(sr.preparationState)) {
      errors.push({ check: 'raw-only', produceId: pid, message: `preparationState "${sr.preparationState}" does not contain "raw"` })
    }
  }

  // 10–11. Input step checks
  for (const unit of record.units) {
    if (!unit.allowDecimal && unit.inputStep !== 1) {
      errors.push({ check: 'integer-step', produceId: pid, message: `Unit ${unit.unitKey} has allowDecimal=false but inputStep=${unit.inputStep}` })
    }
    if (unit.allowDecimal && unit.inputStep <= 0) {
      errors.push({ check: 'decimal-step', produceId: pid, message: `Unit ${unit.unitKey} has allowDecimal=true but inputStep=${unit.inputStep}` })
    }
  }

  // 12. Immutability
  if (!Object.isFrozen(PRODUCE_PORTIONS)) {
    errors.push({ check: 'immutability', produceId: pid, message: 'PRODUCE_PORTIONS is not frozen' })
  }

  // 13. Unit key uniqueness
  const unitKeys = new Set<string>()
  for (const unit of record.units) {
    if (unitKeys.has(unit.unitKey)) {
      errors.push({ check: 'unit-key-unique', produceId: pid, message: `Duplicate unitKey "${unit.unitKey}"` })
    }
    unitKeys.add(unit.unitKey)
  }

  // 14. Size key uniqueness
  for (const unit of record.units) {
    const sizeKeys = new Set<string>()
    for (const size of unit.sizes) {
      if (sizeKeys.has(size.sizeKey)) {
        errors.push({ check: 'size-key-unique', produceId: pid, message: `Duplicate sizeKey "${size.sizeKey}" in unit ${unit.unitKey}` })
      }
      sizeKeys.add(size.sizeKey)
    }
  }

  // 15. Confidence valid
  if (!['high', 'medium', 'low'].includes(record.confidence)) {
    errors.push({ check: 'confidence-valid', produceId: pid, message: `Invalid confidence "${record.confidence}"` })
  }

  // 16. Authority valid
  for (const sr of record.sourceRecords) {
    if (!['USDA', 'FDA', 'peer-reviewed'].includes(sr.authority)) {
      errors.push({ check: 'authority-valid', produceId: pid, message: `Invalid authority "${sr.authority}"` })
    }
  }

  // 17. Quantity-supported consistency
  if (record.quantitySupported && record.units.length === 0) {
    errors.push({ check: 'qty-supported', produceId: pid, message: 'quantitySupported=true but no units defined' })
  }

  // 18. Weight-only consistency
  if (!record.quantitySupported && record.units.length > 0) {
    errors.push({ check: 'weight-only', produceId: pid, message: 'quantitySupported=false but units are defined' })
  }
}

// Summary
const totalChecks = 18
const passedChecks = totalChecks // will adjust if errors

console.log('=== Produce Portion Registry Validator ===\n')
console.log(`PRODUCE_DATA keys:     ${produceDataKeys.length}`)
console.log(`PRODUCE_PORTIONS keys: ${portionKeys.length}`)
console.log(`Checks run:            ${totalChecks}`)
console.log(`Errors:                ${errors.length}`)
console.log(`Warnings:              ${warnings.length}\n`)

if (errors.length > 0) {
  console.log('--- ERRORS ---')
  for (const e of errors) {
    console.log(`  [${e.check}] ${e.produceId}: ${e.message}`)
  }
  console.log('')
}

if (warnings.length > 0) {
  console.log('--- WARNINGS ---')
  for (const w of warnings) {
    console.log(`  [${w.check}] ${w.produceId}: ${w.message}`)
  }
  console.log('')
}

if (errors.length === 0) {
  console.log('All validation checks passed.')
  process.exit(0)
} else {
  console.log(`VALIDATION FAILED with ${errors.length} error(s).`)
  process.exit(1)
}
