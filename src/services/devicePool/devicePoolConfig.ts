// ─────────────────────────────────────────────────────────────
// devicePoolConfig.ts — Configuration for the device-shared
// free pool system.
//
// Client-side config uses EXPO_PUBLIC_ variables only.
// Server-side config uses Deno.env / Supabase secrets.
// ─────────────────────────────────────────────────────────────

import { Platform } from 'react-native'
import type { EnforcementMode } from './deviceRecallBits'

// ── Client-side configuration ────────────────────────────────

export function getDevicePoolMode (): EnforcementMode {
  const raw = process.env.EXPO_PUBLIC_DEVICE_FREE_POOL_MODE
  if (raw === 'enforce') return 'enforce'
  if (raw === 'observe') return 'observe'
  return 'off'
}

export function isDevicePoolEnabled (): boolean {
  return getDevicePoolMode() !== 'off'
}

// ── Provider selection ───────────────────────────────────────

export type ProviderType = 'android_play_integrity' | 'development_mock' | 'unsupported'

export function selectProviderType (): ProviderType {
  const mode = getDevicePoolMode()

  // Off mode: no provider needed
  if (mode === 'off') return 'unsupported'

  // Development builds use the mock provider
  if (__DEV__) return 'development_mock'

  // Production Android uses Play Integrity
  if (Platform.OS === 'android') return 'android_play_integrity'

  // iOS and other platforms: unsupported
  return 'unsupported'
}
