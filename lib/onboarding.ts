// ─────────────────────────────────────────────────────────────
// lib/onboarding.ts — Standalone onboarding state helpers
// Direct AsyncStorage access for use outside React tree
// (e.g. loading gate before providers mount).
// The canonical state lives in ActivationStore — these helpers
// read/write the same key for consistency.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@juicing_activation_v1'

export async function getOnboardingComplete(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return parsed?.onboardingComplete === true
  } catch {
    return false
  }
}

export async function setOnboardingComplete(value: boolean): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    const state = raw ? JSON.parse(raw) : {}
    state.onboardingComplete = value
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('[onboarding] setOnboardingComplete failed:', e)
  }
}

export async function clearOnboardingComplete(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    const state = raw ? JSON.parse(raw) : {}
    delete state.onboardingComplete
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('[onboarding] clearOnboardingComplete failed:', e)
  }
}
