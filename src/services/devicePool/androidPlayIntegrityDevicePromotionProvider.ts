// ─────────────────────────────────────────────────────────────
// androidPlayIntegrityDevicePromotionProvider.ts — Production
// Android provider using Google Play Integrity with Device Recall.
//
// This provider requests a Play Integrity token bound to the
// scan request context using the official requestHash mechanism.
// The token is sent to the server for verification — the client
// never interprets Device Recall values directly.
//
// IMPORTANT:
//   * This provider uses a native Expo module (expo-play-integrity)
//     that must be configured in the native Android project.
//   * Device Recall is a beta feature requiring Google Play
//     Console enrollment and approval.
//   * The provider gracefully degrades to unsupported if the
//     native module is not available.
// ─────────────────────────────────────────────────────────────

import { Platform } from 'react-native'
import type {
  DevicePromotionProvider,
  AttestationRequestContext,
  AttestationResult,
} from './devicePromotionProvider'
import { integrityLog } from './integrityLog'

// Lazy-load the native module so the file doesn't crash on
// platforms where it doesn't exist.
function getNativeModule(): any | null {
  if (Platform.OS !== 'android') return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../../../../modules/expo-play-integrity')
    return mod.default ?? mod
  } catch (e) {
    const msg = (e as Error)?.message ?? ''
    const reason =
      msg.includes('not found') || msg.includes('Unable to resolve')
        ? 'native_module_unavailable'
        : 'unexpected_error'
    integrityLog('native_error', 'unknown', false, reason as any, { location: 'require' })
    return null
  }
}

export class AndroidPlayIntegrityDevicePromotionProvider implements DevicePromotionProvider {
  private nativeModule: any | null

  constructor() {
    this.nativeModule = getNativeModule()
  }

  isSupported(): boolean {
    return Platform.OS === 'android' && this.nativeModule != null
  }

  async getAttestationForScan(ctx: AttestationRequestContext): Promise<AttestationResult> {
    if (!this.isSupported() || !this.nativeModule) {
      integrityLog('provider_support', ctx.challenge, false, 'native_module_unavailable')
      throw new Error('Play Integrity not available on this device')
    }

    // Build the request hash from server-controlled material.
    // The server will recompute and validate this hash.
    const requestHash = [ctx.challenge, ctx.userId, ctx.action, ctx.requestPayloadDigest].join('|')

    const cloudProjectNumberStr = process.env.EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER || ''
    const cloudProjectNumber = parseInt(cloudProjectNumberStr, 10)
    if (!cloudProjectNumber || isNaN(cloudProjectNumber)) {
      integrityLog('native_error', ctx.challenge, false, 'cloud_project_number_missing')
      throw new Error('Play Integrity cloud project number not configured')
    }

    integrityLog('native_call_start', ctx.challenge, true, undefined, {
      cloudProjectNumberValid: true,
    })

    let token: string
    try {
      token = await this.nativeModule.requestIntegrityToken({
        requestHash,
        cloudProjectNumber,
      })
    } catch (e) {
      const msg = (e as Error)?.message ?? ''
      let reason = 'token_request_failed'
      if (msg.includes('PI_') || msg.includes('prepare') || msg.includes('PREPARATION')) {
        reason = 'prepare_failed'
      } else if (msg.includes('not available') || msg.includes('native')) {
        reason = 'native_module_unavailable'
      }
      integrityLog('native_error', ctx.challenge, false, reason as any)
      throw e
    }

    if (!token) {
      integrityLog('native_token_blank', ctx.challenge, false, 'blank_token')
      throw new Error('Play Integrity returned blank token')
    }

    integrityLog('native_token_received', ctx.challenge, true, 'success', { tokenPresent: true })

    return {
      token,
      provider: 'android_play_integrity',
      isMock: false,
    }
  }

  getDevelopmentStatus(): 'production' {
    return 'production'
  }

  getProviderName(): string {
    return 'android_play_integrity'
  }
}
