// ─────────────────────────────────────────────────────────────
// lib/storage.ts — Juice log storage stubs (AsyncStorage)
// Simple array-based log for mock scanner and future real use.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'

const LOG_KEY = '@juicing_log_entries_v1'

export interface JuiceLogEntry {
  id: string
  timestamp: string
  ingredients: { name: string, nutrient: string }[]
  nutrients: string[]
}

export async function saveJuiceLogEntry(entry: JuiceLogEntry): Promise<void> {
  try {
    const existing = await getJuiceLogEntries()
    existing.unshift(entry)
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(existing))
  } catch (e) {
    console.warn('[storage] saveJuiceLogEntry failed:', (e as Error)?.message)
  }
}

export async function getJuiceLogEntries(): Promise<JuiceLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.warn('[storage] getJuiceLogEntries failed:', (e as Error)?.message)
    return []
  }
}

export async function clearJuiceLog(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOG_KEY)
  } catch (e) {
    console.warn('[storage] clearJuiceLog failed:', (e as Error)?.message)
  }
}
