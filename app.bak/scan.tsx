// ─────────────────────────────────────────────────────────────
// app/scan.tsx — Scanner route with mock/real switch
// Uses USE_MOCK_CAMERA flag to choose between MockScanner
// (Expo Go friendly) and RealScanner (Dev Build).
// ─────────────────────────────────────────────────────────────

import React from 'react'
import { USE_MOCK_CAMERA } from '../lib/flags'
import MockScanner from '../components/scanner/MockScanner'
import RealScanner from '../components/scanner/RealScanner'

export default function ScanScreen() {
  return USE_MOCK_CAMERA ? <MockScanner /> : <RealScanner />
}
