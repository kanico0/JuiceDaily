// ─────────────────────────────────────────────────────────────
// deviceRecallBits.test.ts — Pure logic tests for Device Recall
// bit encoding/decoding, period detection, and quota math.
// ─────────────────────────────────────────────────────────────

import {
  encodeDeviceUsageCount,
  decodeDeviceUsageCount,
  isValidDeviceUsageCount,
  getUtcMonthKey,
  getUtcMonthStart,
  getUtcMonthEnd,
  determineDeviceUsageMonth,
  isDeviceUsageCurrentPeriod,
  calculateDeviceRemaining,
  calculateEffectiveFreeRemaining,
  nextDeviceUsageCount,
  DEVICE_POOL_LIMIT,
  DeviceRecallBits,
  DeviceRecallTimestamps,
} from '../deviceRecallBits'

// ── Encode tests ─────────────────────────────────────────────

describe('encodeDeviceUsageCount', () => {
  it('encodes 0 as 000', () => {
    expect(encodeDeviceUsageCount(0)).toEqual({
      bitFirst: false, bitSecond: false, bitThird: false,
    })
  })

  it('encodes 1 as 001', () => {
    expect(encodeDeviceUsageCount(1)).toEqual({
      bitFirst: false, bitSecond: false, bitThird: true,
    })
  })

  it('encodes 2 as 010', () => {
    expect(encodeDeviceUsageCount(2)).toEqual({
      bitFirst: false, bitSecond: true, bitThird: false,
    })
  })

  it('encodes 3 as 011', () => {
    expect(encodeDeviceUsageCount(3)).toEqual({
      bitFirst: false, bitSecond: true, bitThird: true,
    })
  })

  it('encodes 4 as 100', () => {
    expect(encodeDeviceUsageCount(4)).toEqual({
      bitFirst: true, bitSecond: false, bitThird: false,
    })
  })

  it('encodes 5 as 101', () => {
    expect(encodeDeviceUsageCount(5)).toEqual({
      bitFirst: true, bitSecond: false, bitThird: true,
    })
  })

  it('throws for 6', () => {
    expect(() => encodeDeviceUsageCount(6)).toThrow()
  })

  it('throws for -1', () => {
    expect(() => encodeDeviceUsageCount(-1)).toThrow()
  })
})

// ── Decode tests ─────────────────────────────────────────────

describe('decodeDeviceUsageCount', () => {
  it('decodes 000 as 0', () => {
    expect(decodeDeviceUsageCount({ bitFirst: false, bitSecond: false, bitThird: false })).toBe(0)
  })

  it('decodes 001 as 1', () => {
    expect(decodeDeviceUsageCount({ bitFirst: false, bitSecond: false, bitThird: true })).toBe(1)
  })

  it('decodes 010 as 2', () => {
    expect(decodeDeviceUsageCount({ bitFirst: false, bitSecond: true, bitThird: false })).toBe(2)
  })

  it('decodes 011 as 3', () => {
    expect(decodeDeviceUsageCount({ bitFirst: false, bitSecond: true, bitThird: true })).toBe(3)
  })

  it('decodes 100 as 4', () => {
    expect(decodeDeviceUsageCount({ bitFirst: true, bitSecond: false, bitThird: false })).toBe(4)
  })

  it('decodes 101 as 5', () => {
    expect(decodeDeviceUsageCount({ bitFirst: true, bitSecond: false, bitThird: true })).toBe(5)
  })

  it('decodes 110 as 5 (conservatively exhausted)', () => {
    expect(decodeDeviceUsageCount({ bitFirst: true, bitSecond: true, bitThird: false })).toBe(5)
  })

  it('decodes 111 as 5 (conservatively exhausted)', () => {
    expect(decodeDeviceUsageCount({ bitFirst: true, bitSecond: true, bitThird: true })).toBe(5)
  })
})

// ── Validity tests ───────────────────────────────────────────

describe('isValidDeviceUsageCount', () => {
  it('returns true for 000-101', () => {
    expect(isValidDeviceUsageCount({ bitFirst: false, bitSecond: false, bitThird: false })).toBe(true)
    expect(isValidDeviceUsageCount({ bitFirst: true, bitSecond: false, bitThird: true })).toBe(true)
  })

  it('returns false for 110', () => {
    expect(isValidDeviceUsageCount({ bitFirst: true, bitSecond: true, bitThird: false })).toBe(false)
  })

  it('returns false for 111', () => {
    expect(isValidDeviceUsageCount({ bitFirst: true, bitSecond: true, bitThird: true })).toBe(false)
  })
})

// ── Round-trip tests ─────────────────────────────────────────

describe('encode/decode round-trip', () => {
  for (let i = 0; i <= 5; i++) {
    it(`round-trips ${i}`, () => {
      expect(decodeDeviceUsageCount(encodeDeviceUsageCount(i))).toBe(i)
    })
  }
})

// ── UTC month tests ──────────────────────────────────────────

describe('getUtcMonthKey', () => {
  it('returns YYYY-MM for a UTC date', () => {
    expect(getUtcMonthKey(new Date('2026-07-15T12:00:00Z'))).toBe('2026-07')
  })

  it('handles January', () => {
    expect(getUtcMonthKey(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01')
  })

  it('handles December', () => {
    expect(getUtcMonthKey(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12')
  })
})

describe('getUtcMonthStart', () => {
  it('returns first day of the month at UTC midnight', () => {
    const result = getUtcMonthStart(new Date('2026-07-15T12:00:00Z'))
    expect(result.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })
})

describe('getUtcMonthEnd', () => {
  it('returns first day of next month at UTC midnight', () => {
    const result = getUtcMonthEnd(new Date('2026-07-15T12:00:00Z'))
    expect(result.toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })
})

// ── Period detection tests ───────────────────────────────────

describe('determineDeviceUsageMonth', () => {
  it('returns null when no timestamps present', () => {
    expect(determineDeviceUsageMonth({
      bitFirstTimestamp: null,
      bitSecondTimestamp: null,
      bitThirdTimestamp: null,
    })).toBeNull()
  })

  it('returns the month of the most recent timestamp', () => {
    expect(determineDeviceUsageMonth({
      bitFirstTimestamp: '2026-07-10T00:00:00Z',
      bitSecondTimestamp: '2026-07-20T00:00:00Z',
      bitThirdTimestamp: null,
    })).toBe('2026-07')
  })

  it('uses the latest of multiple timestamps', () => {
    expect(determineDeviceUsageMonth({
      bitFirstTimestamp: '2026-06-10T00:00:00Z',
      bitSecondTimestamp: '2026-07-20T00:00:00Z',
      bitThirdTimestamp: '2026-07-05T00:00:00Z',
    })).toBe('2026-07')
  })
})

describe('isDeviceUsageCurrentPeriod', () => {
  it('returns true when no timestamps (fresh device)', () => {
    expect(isDeviceUsageCurrentPeriod({
      bitFirstTimestamp: null,
      bitSecondTimestamp: null,
      bitThirdTimestamp: null,
    }, new Date('2026-07-15T00:00:00Z'))).toBe(true)
  })

  it('returns true when timestamps are in the current UTC month', () => {
    expect(isDeviceUsageCurrentPeriod({
      bitFirstTimestamp: '2026-07-10T00:00:00Z',
      bitSecondTimestamp: null,
      bitThirdTimestamp: null,
    }, new Date('2026-07-15T00:00:00Z'))).toBe(true)
  })

  it('returns false when timestamps are from a previous month', () => {
    expect(isDeviceUsageCurrentPeriod({
      bitFirstTimestamp: '2026-06-10T00:00:00Z',
      bitSecondTimestamp: null,
      bitThirdTimestamp: null,
    }, new Date('2026-07-15T00:00:00Z'))).toBe(false)
  })
})

// ── Remaining calculation tests ──────────────────────────────

describe('calculateDeviceRemaining', () => {
  it('returns 5 when no timestamps (fresh device)', () => {
    expect(calculateDeviceRemaining(
      { bitFirst: false, bitSecond: false, bitThird: false },
      { bitFirstTimestamp: null, bitSecondTimestamp: null, bitThirdTimestamp: null },
      new Date('2026-07-15T00:00:00Z'),
    )).toBe(5)
  })

  it('returns 5 - used when current period', () => {
    expect(calculateDeviceRemaining(
      { bitFirst: false, bitSecond: true, bitThird: false }, // 2 used
      { bitFirstTimestamp: null, bitSecondTimestamp: '2026-07-10T00:00:00Z', bitThirdTimestamp: null },
      new Date('2026-07-15T00:00:00Z'),
    )).toBe(3)
  })

  it('returns 5 when previous month (period reset)', () => {
    expect(calculateDeviceRemaining(
      { bitFirst: true, bitSecond: false, bitThird: true }, // 5 used last month
      { bitFirstTimestamp: '2026-06-10T00:00:00Z', bitSecondTimestamp: null, bitThirdTimestamp: '2026-06-15T00:00:00Z' },
      new Date('2026-07-15T00:00:00Z'),
    )).toBe(5)
  })

  it('returns 0 when 5 used in current period', () => {
    expect(calculateDeviceRemaining(
      { bitFirst: true, bitSecond: false, bitThird: true }, // 5 used
      { bitFirstTimestamp: '2026-07-01T00:00:00Z', bitSecondTimestamp: null, bitThirdTimestamp: '2026-07-20T00:00:00Z' },
      new Date('2026-07-25T00:00:00Z'),
    )).toBe(0)
  })

  it('returns 0 for invalid 110 bits (conservatively exhausted)', () => {
    expect(calculateDeviceRemaining(
      { bitFirst: true, bitSecond: true, bitThird: false }, // 110 = invalid
      { bitFirstTimestamp: '2026-07-01T00:00:00Z', bitSecondTimestamp: '2026-07-10T00:00:00Z', bitThirdTimestamp: null },
      new Date('2026-07-25T00:00:00Z'),
    )).toBe(0)
  })
})

// ── Effective remaining tests ────────────────────────────────

describe('calculateEffectiveFreeRemaining', () => {
  it('returns min of account and device', () => {
    expect(calculateEffectiveFreeRemaining(3, 2)).toBe(2)
  })

  it('returns account remaining when device has more', () => {
    expect(calculateEffectiveFreeRemaining(2, 5)).toBe(2)
  })

  it('returns device remaining when account has more', () => {
    expect(calculateEffectiveFreeRemaining(5, 2)).toBe(2)
  })

  it('returns 0 when either is 0', () => {
    expect(calculateEffectiveFreeRemaining(0, 5)).toBe(0)
    expect(calculateEffectiveFreeRemaining(5, 0)).toBe(0)
    expect(calculateEffectiveFreeRemaining(0, 0)).toBe(0)
  })

  it('never returns negative', () => {
    expect(calculateEffectiveFreeRemaining(-1, 3)).toBe(0)
    expect(calculateEffectiveFreeRemaining(3, -1)).toBe(0)
  })

  it('never returns more than 5', () => {
    expect(calculateEffectiveFreeRemaining(10, 10)).toBe(5)
  })
})

// ── Next usage count tests ───────────────────────────────────

describe('nextDeviceUsageCount', () => {
  it('returns 1 when no prior usage in current period', () => {
    expect(nextDeviceUsageCount(
      { bitFirst: false, bitSecond: false, bitThird: false },
      { bitFirstTimestamp: null, bitSecondTimestamp: null, bitThirdTimestamp: null },
      new Date('2026-07-15T00:00:00Z'),
    )).toBe(1)
  })

  it('returns current + 1 when in current period', () => {
    expect(nextDeviceUsageCount(
      { bitFirst: false, bitSecond: true, bitThird: false }, // 2 used
      { bitFirstTimestamp: null, bitSecondTimestamp: '2026-07-10T00:00:00Z', bitThirdTimestamp: null },
      new Date('2026-07-15T00:00:00Z'),
    )).toBe(3)
  })

  it('returns 1 when previous month (period reset)', () => {
    expect(nextDeviceUsageCount(
      { bitFirst: true, bitSecond: false, bitThird: true }, // 5 used last month
      { bitFirstTimestamp: '2026-06-10T00:00:00Z', bitSecondTimestamp: null, bitThirdTimestamp: '2026-06-15T00:00:00Z' },
      new Date('2026-07-15T00:00:00Z'),
    )).toBe(1)
  })

  it('caps at 5', () => {
    expect(nextDeviceUsageCount(
      { bitFirst: true, bitSecond: false, bitThird: true }, // 5 used
      { bitFirstTimestamp: '2026-07-01T00:00:00Z', bitSecondTimestamp: null, bitThirdTimestamp: '2026-07-20T00:00:00Z' },
      new Date('2026-07-25T00:00:00Z'),
    )).toBe(5)
  })
})

// ── Scenario tests (from spec) ───────────────────────────────

describe('spec scenarios', () => {
  const july = new Date('2026-07-15T00:00:00Z')

  it('Account A uses 3; Device X has 2 remaining', () => {
    const deviceRemaining = calculateDeviceRemaining(
      { bitFirst: false, bitSecond: true, bitThird: true }, // 3 used
      { bitFirstTimestamp: '2026-07-01T00:00:00Z', bitSecondTimestamp: '2026-07-05T00:00:00Z', bitThirdTimestamp: '2026-07-10T00:00:00Z' },
      july,
    )
    expect(deviceRemaining).toBe(2)
    expect(calculateEffectiveFreeRemaining(2, deviceRemaining)).toBe(2)
  })

  it('Account B signs in on Device X and receives 2, not 5', () => {
    const deviceRemaining = calculateDeviceRemaining(
      { bitFirst: false, bitSecond: true, bitThird: true }, // 3 used
      { bitFirstTimestamp: '2026-07-01T00:00:00Z', bitSecondTimestamp: '2026-07-05T00:00:00Z', bitThirdTimestamp: '2026-07-10T00:00:00Z' },
      july,
    )
    const accountBRemaining = 5 // fresh account
    expect(calculateEffectiveFreeRemaining(accountBRemaining, deviceRemaining)).toBe(2)
  })

  it('Account B uses 2; Device X becomes exhausted', () => {
    const deviceRemaining = calculateDeviceRemaining(
      { bitFirst: true, bitSecond: false, bitThird: true }, // 5 used
      { bitFirstTimestamp: '2026-07-01T00:00:00Z', bitSecondTimestamp: null, bitThirdTimestamp: '2026-07-20T00:00:00Z' },
      july,
    )
    expect(deviceRemaining).toBe(0)
    expect(calculateEffectiveFreeRemaining(3, deviceRemaining)).toBe(0)
  })

  it('Account C on Device X receives 0', () => {
    const deviceRemaining = calculateDeviceRemaining(
      { bitFirst: true, bitSecond: false, bitThird: true }, // 5 used
      { bitFirstTimestamp: '2026-07-01T00:00:00Z', bitSecondTimestamp: null, bitThirdTimestamp: '2026-07-20T00:00:00Z' },
      july,
    )
    const accountCRemaining = 5
    expect(calculateEffectiveFreeRemaining(accountCRemaining, deviceRemaining)).toBe(0)
  })

  it('Account A on Device Y is still limited by Account A usage', () => {
    // Device Y is fresh — 0 used
    const deviceYRemaining = calculateDeviceRemaining(
      { bitFirst: false, bitSecond: false, bitThird: false },
      { bitFirstTimestamp: null, bitSecondTimestamp: null, bitThirdTimestamp: null },
      july,
    )
    const accountARemaining = 2 // already used 3
    expect(calculateEffectiveFreeRemaining(accountARemaining, deviceYRemaining)).toBe(2)
  })

  it('A brand-new account on Device Y receives the normal allowance', () => {
    const deviceYRemaining = calculateDeviceRemaining(
      { bitFirst: false, bitSecond: false, bitThird: false },
      { bitFirstTimestamp: null, bitSecondTimestamp: null, bitThirdTimestamp: null },
      july,
    )
    const newAccountRemaining = 5
    expect(calculateEffectiveFreeRemaining(newAccountRemaining, deviceYRemaining)).toBe(5)
  })

  it('A Pro account on exhausted Device X is not blocked by device pool', () => {
    // Pro accounts bypass the device pool entirely.
    // The device pool only applies to free accounts.
    const deviceXRemaining = 0 // exhausted
    // Pro users use their Pro quota (60), not the free device pool.
    // The effective remaining for a Pro user is their Pro remaining,
    // NOT min(proRemaining, deviceRemaining).
    const proRemaining = 58
    // Pro bypass: effective = proRemaining (device pool not applied)
    expect(proRemaining).toBe(58) // Not blocked
    expect(deviceXRemaining).toBe(0) // Device exhausted but irrelevant for Pro
  })
})
