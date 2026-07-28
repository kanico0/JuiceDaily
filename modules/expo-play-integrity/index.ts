// expo-play-integrity — TypeScript entry point
// This module provides a native bridge to Google Play Integrity
// for requesting integrity tokens bound to scan requests.

import { NativeModules } from 'react-native'

type IntegrityTokenOptions = {
  requestHash: string
  cloudProjectNumber: number
}

type ExpoPlayIntegrityType = {
  requestIntegrityToken(options: IntegrityTokenOptions): Promise<string>
  clearCache(): Promise<void>
}

const ExpoPlayIntegrity: ExpoPlayIntegrityType | null =
  NativeModules.ExpoPlayIntegrity ?? null

export default ExpoPlayIntegrity
