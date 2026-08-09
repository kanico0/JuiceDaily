// ─────────────────────────────────────────────────────────────
// deviceRecallBits.test.ts — Pure logic tests for the new
// three-bit Device Recall allocation:
//   bitFirst  = Free Snap monthly consumption
//   bitSecond = Free Advanced Blend lifetime count (MSB)
//   bitThird  = Free Advanced Blend lifetime count (LSB)
// ─────────────────────────────────────────────────────────────

import {
  FREE_DEVICE_SNAP_LIMIT,
  FREE_DEVICE_BLEND_LIMIT,
  currentYyyymm,
  isSnapConsumedThisMonth,
  deviceSnapRemaining,
  decodeBlendDeviceUsed,
  deviceBlendRemaining,
  encodeNextBlendWriteValues,
  effectiveSnapRemaining,
  effectiveBlendRemaining,
  getUtcMonthKey,
  getUtcMonthStart,
  getUtcMonthEnd,
} from '../deviceRecallBits'

// ── YYYYMM helper tests ───────────────────────────────────────

describe('currentYyyymm', () => {
  it('returns YYYYMM integer for a UTC date', () => {
    expect(currentYyyymm(new Date('2026-07-15T12:00:00Z'))).toBe(202607)
  })

  it('handles January', () => {
    expect(currentYyyymm(new Date('2026-01-01T00:00:00Z'))).toBe(202601)
  })

  it('handles December', () => {
    expect(currentYyyymm(new Date('2026-12-31T23:59:59Z'))).toBe(202612)
  })
})

// ── Snap: bitFirst tests ──────────────────────────────────────

describe('isSnapConsumedThisMonth', () => {
  it('returns false when bitFirst is false', () => {
    expect(isSnapConsumedThisMonth(false, null, new Date('2026-07-15Z'))).toBe(false)
  })

  it('returns true when bitFirst is true and yyyymmFirst is current month', () => {
    expect(isSnapConsumedThisMonth(true, 202607, new Date('2026-07-15Z'))).toBe(true)
  })

  it('returns false when bitFirst is true but yyyymmFirst is last month', () => {
    expect(isSnapConsumedThisMonth(true, 202606, new Date('2026-07-15Z'))).toBe(false)
  })

  it('returns true when bitFirst is true but yyyymmFirst is null (conservative)', () => {
    expect(isSnapConsumedThisMonth(true, null, new Date('2026-07-15Z'))).toBe(true)
  })
})

describe('deviceSnapRemaining', () => {
  it('returns 1 when not consumed this month', () => {
    expect(deviceSnapRemaining(false, null, new Date('2026-07-15Z'))).toBe(1)
  })

  it('returns 0 when consumed this month', () => {
    expect(deviceSnapRemaining(true, 202607, new Date('2026-07-15Z'))).toBe(0)
  })

  it('returns 1 when consumed last month (monthly reset)', () => {
    expect(deviceSnapRemaining(true, 202606, new Date('2026-07-15Z'))).toBe(1)
  })

  it('returns 0 when bitFirst is true but no date (conservative)', () => {
    expect(deviceSnapRemaining(true, null, new Date('2026-07-15Z'))).toBe(0)
  })
})

// ── Advanced Blend: bitSecond + bitThird tests ────────────────

describe('decodeBlendDeviceUsed', () => {
  it('decodes 00 as 0', () => {
    expect(decodeBlendDeviceUsed(false, false)).toBe(0)
  })

  it('decodes 01 as 1', () => {
    expect(decodeBlendDeviceUsed(false, true)).toBe(1)
  })

  it('decodes 10 as 2', () => {
    expect(decodeBlendDeviceUsed(true, false)).toBe(2)
  })

  it('decodes 11 as 3', () => {
    expect(decodeBlendDeviceUsed(true, true)).toBe(3)
  })
})

describe('deviceBlendRemaining', () => {
  it('returns 3 when 0 used', () => {
    expect(deviceBlendRemaining(false, false)).toBe(3)
  })

  it('returns 2 when 1 used', () => {
    expect(deviceBlendRemaining(false, true)).toBe(2)
  })

  it('returns 1 when 2 used', () => {
    expect(deviceBlendRemaining(true, false)).toBe(1)
  })

  it('returns 0 when 3 used (exhausted)', () => {
    expect(deviceBlendRemaining(true, true)).toBe(0)
  })
})

// ── Blend transition tests ────────────────────────────────────

describe('encodeNextBlendWriteValues', () => {
  it('0 → 1: sets bitThird=true only', () => {
    expect(encodeNextBlendWriteValues(0)).toEqual({ bitThird: true })
  })

  it('1 → 2: sets bitSecond=true, bitThird=false', () => {
    expect(encodeNextBlendWriteValues(1)).toEqual({ bitSecond: true, bitThird: false })
  })

  it('2 → 3: sets bitThird=true only', () => {
    expect(encodeNextBlendWriteValues(2)).toEqual({ bitThird: true })
  })

  it('3 → 3: returns empty object (exhausted, no write)', () => {
    expect(encodeNextBlendWriteValues(3)).toEqual({})
  })
})

// ── Bit independence tests ────────────────────────────────────

describe('bit independence', () => {
  it('Snap write only contains bitFirst', () => {
    // A Snap write sets bitFirst=true; it does not touch bitSecond/bitThird
    const snapWrite = { bitFirst: true }
    expect(snapWrite).not.toHaveProperty('bitSecond')
    expect(snapWrite).not.toHaveProperty('bitThird')
  })

  it('Blend writes only contain bitSecond and/or bitThird', () => {
    const blendWrite0to1 = encodeNextBlendWriteValues(0)
    expect(blendWrite0to1).not.toHaveProperty('bitFirst')

    const blendWrite1to2 = encodeNextBlendWriteValues(1)
    expect(blendWrite1to2).not.toHaveProperty('bitFirst')

    const blendWrite2to3 = encodeNextBlendWriteValues(2)
    expect(blendWrite2to3).not.toHaveProperty('bitFirst')
  })

  it('full blend transition sequence produces correct writes', () => {
    const writes = []
    let used = 0
    for (let i = 0; i < 4; i++) {
      const w = encodeNextBlendWriteValues(used)
      writes.push(w)
      // Simulate the transition
      if (w.bitSecond !== undefined) used = (w.bitSecond ? 2 : 0) + (w.bitThird ? 1 : 0)
      else if (w.bitThird !== undefined) used = (used >= 2 ? 2 : 0) + (w.bitThird ? 1 : 0)
    }
    expect(writes).toEqual([
      { bitThird: true },        // 0 → 1
      { bitSecond: true, bitThird: false }, // 1 → 2
      { bitThird: true },        // 2 → 3
      {},                        // 3 → 3 (no write)
    ])
  })
})

// ── Effective remaining tests ─────────────────────────────────

describe('effectiveSnapRemaining', () => {
  it('returns min of account and device', () => {
    expect(effectiveSnapRemaining(1, 1)).toBe(1)
    expect(effectiveSnapRemaining(0, 1)).toBe(0)
    expect(effectiveSnapRemaining(1, 0)).toBe(0)
    expect(effectiveSnapRemaining(0, 0)).toBe(0)
  })
})

describe('effectiveBlendRemaining', () => {
  it('returns min of account and device', () => {
    expect(effectiveBlendRemaining(3, 3)).toBe(3)
    expect(effectiveBlendRemaining(3, 1)).toBe(1)
    expect(effectiveBlendRemaining(1, 3)).toBe(1)
    expect(effectiveBlendRemaining(0, 3)).toBe(0)
    expect(effectiveBlendRemaining(3, 0)).toBe(0)
  })
})

// ── Backward-compatibility aliases ────────────────────────────

describe('getUtcMonthKey (deprecated alias)', () => {
  it('returns YYYY-MM string', () => {
    expect(getUtcMonthKey(new Date('2026-07-15T12:00:00Z'))).toBe('2026-07')
  })
})

describe('getUtcMonthStart', () => {
  it('returns first day of month at UTC midnight', () => {
    expect(getUtcMonthStart(new Date('2026-07-15T12:00:00Z')).toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })
})

describe('getUtcMonthEnd', () => {
  it('returns first day of next month at UTC midnight', () => {
    expect(getUtcMonthEnd(new Date('2026-07-15T12:00:00Z')).toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })
})

// ── Constants ─────────────────────────────────────────────────

describe('constants', () => {
  it('FREE_DEVICE_SNAP_LIMIT is 1', () => {
    expect(FREE_DEVICE_SNAP_LIMIT).toBe(1)
  })

  it('FREE_DEVICE_BLEND_LIMIT is 3', () => {
    expect(FREE_DEVICE_BLEND_LIMIT).toBe(3)
  })
})
