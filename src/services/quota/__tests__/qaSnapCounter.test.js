// ─────────────────────────────────────────────────────────────
// qaSnapCounter.test.js — Tests for the QA-only snap counter
// ─────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {}
  return {
    getItem: jest.fn((key) => Promise.resolve(store[key] || null)),
    setItem: jest.fn((key, val) => { store[key] = val; return Promise.resolve() }),
    removeItem: jest.fn((key) => { delete store[key]; return Promise.resolve() }),
    getAllKeys: jest.fn(() => Promise.resolve(Object.keys(store))),
    multiRemove: jest.fn((keys) => { keys.forEach((k) => delete store[k]); return Promise.resolve() }),
  }
})

import {
  getQaProSnapUsage,
  incrementQaProSnapUsage,
  resetQaProSnapUsage,
  getQaProSnapRemaining,
} from '../qaSnapCounter'
import AsyncStorage from '@react-native-async-storage/async-storage'

describe('qaSnapCounter', () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem('@juicing_qa_pro_snap_counter_v1')
    await AsyncStorage.removeItem('@juicing_qa_pro_snap_reset_v1')
  })

  test('initial usage is 0', async () => {
    const usage = await getQaProSnapUsage()
    expect(usage.used).toBe(0)
  })

  test('increment increases usage by 1', async () => {
    await incrementQaProSnapUsage()
    const usage = await getQaProSnapUsage()
    expect(usage.used).toBe(1)
  })

  test('multiple increments accumulate', async () => {
    await incrementQaProSnapUsage()
    await incrementQaProSnapUsage()
    await incrementQaProSnapUsage()
    const usage = await getQaProSnapUsage()
    expect(usage.used).toBe(3)
  })

  test('remaining = limit - used', async () => {
    await incrementQaProSnapUsage()
    await incrementQaProSnapUsage()
    const remaining = await getQaProSnapRemaining(12)
    expect(remaining).toBe(10)
  })

  test('remaining never goes negative', async () => {
    for (let i = 0; i < 15; i++) {
      await incrementQaProSnapUsage()
    }
    const remaining = await getQaProSnapRemaining(12)
    expect(remaining).toBe(0)
  })

  test('reset sets usage back to 0', async () => {
    await incrementQaProSnapUsage()
    await incrementQaProSnapUsage()
    await resetQaProSnapUsage()
    const usage = await getQaProSnapUsage()
    expect(usage.used).toBe(0)
  })

  test('reset returns the reset record', async () => {
    const result = await resetQaProSnapUsage()
    expect(result.used).toBe(0)
    expect(result.monthKey).toBeDefined()
  })

  test('default limit is 12', async () => {
    const remaining = await getQaProSnapRemaining()
    expect(remaining).toBe(12)
  })
})
