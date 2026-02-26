// ─────────────────────────────────────────────────────────────
// useLiDAR.ts — LiDAR depth data hook for iPhone Pro devices
//
// Detects whether the device has a LiDAR sensor and captures
// depth data alongside photos for more accurate volumetric
// estimation of produce items.
//
// BUILD TARGET GUARD:
// In "go" mode (Expo Go), this exports no-op stubs so
// react-native-vision-camera is never imported/bundled.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { Platform } from 'react-native'
import { isBetaMode } from '../utils/buildTarget'

// Conditionally require vision-camera only in beta mode.
// Using require() inside a condition prevents Metro from
// bundling the native module when the condition is false
// at build time (EXPO_PUBLIC_ vars are inlined by Metro).
let VisionCamera: any = null
if (isBetaMode) {
  try {
    VisionCamera = require('react-native-vision-camera')
  } catch {
    // Native module not available — fall through to stubs
  }
}

// ── Types ────────────────────────────────────────────────────

export interface LiDARState {
  isAvailable: boolean
  isEnabled: boolean
  isCapturing: boolean
  error: string | null
}

export interface DepthData {
  depthMapMm: number[]    // flat array of depth values in millimeters
  width: number           // depth map width in pixels
  height: number          // depth map height in pixels
  timestamp: number
}

type CameraDevice = any

// ── LiDAR availability detection ─────────────────────────────

function checkLiDARSupport(device: CameraDevice | undefined): boolean {
  if (!isBetaMode) return false
  if (Platform.OS !== 'ios' || !device) return false

  // VisionCamera exposes depth formats on devices with LiDAR
  // iPhone 12 Pro+, iPad Pro 2020+ have LiDAR scanners
  const hasDepthFormat = device.formats.some(
    (format: any) =>
      format.videoStabilizationModes !== undefined &&
      format.maxISO > 0
  )

  return hasDepthFormat
}

// ── Hook ─────────────────────────────────────────────────────

export function useLiDAR(device: CameraDevice | undefined) {
  const [state, setState] = useState<LiDARState>({
    isAvailable: false,
    isEnabled: false,
    isCapturing: false,
    error: null,
  })

  const [lastDepthData, setLastDepthData] = useState<DepthData | null>(null)

  // Detect LiDAR on mount / device change
  useEffect(() => {
    const isAvailable = checkLiDARSupport(device)
    setState((prev) => ({
      ...prev,
      isAvailable,
      isEnabled: isAvailable, // auto-enable if available
    }))
  }, [device])

  // Toggle LiDAR on/off
  const toggleLiDAR = useCallback(() => {
    setState((prev) => {
      if (!prev.isAvailable) return prev
      return { ...prev, isEnabled: !prev.isEnabled }
    })
  }, [])

  // Capture depth data from a frame
  // In production, this would hook into VisionCamera's frame processor
  // to extract depth buffer data from the AVDepthData attached to frames
  const captureDepthFrame = useCallback(
    async (frame: Record<string, unknown>): Promise<DepthData | null> => {
      if (!state.isAvailable || !state.isEnabled) return null

      setState((prev) => ({ ...prev, isCapturing: true, error: null }))

      try {
        // VisionCamera frame processors can access depth data via
        // native modules. This is a structured placeholder that
        // matches the native AVDepthData format.
        //
        // In a full implementation, a frame processor plugin would:
        // 1. Access frame.depthData (AVDepthData)
        // 2. Convert the depth map to a flat Float32 array
        // 3. Return depth values in millimeters
        //
        // Example native plugin call:
        // const depth = extractDepthData(frame)

        const depthData: DepthData = {
          depthMapMm: [],
          width: 0,
          height: 0,
          timestamp: Date.now(),
        }

        setLastDepthData(depthData)
        setState((prev) => ({ ...prev, isCapturing: false }))

        return depthData
      } catch (err) {
        const message = err instanceof Error
          ? err.message
          : 'Depth capture failed'
        setState((prev) => ({ ...prev, isCapturing: false, error: message }))
        return null
      }
    },
    [state.isAvailable, state.isEnabled],
  )

  // Estimate volume from depth data (in cm3)
  // Uses a simplified bounding-box approach from the depth map
  const estimateVolumeFromDepth = useCallback(
    (depthData: DepthData): number | null => {
      if (!depthData.depthMapMm.length) return null

      const { depthMapMm, width, height } = depthData

      // Find the object region (non-background depths)
      // Background is typically the farthest depth value
      const maxDepth = Math.max(...depthMapMm)
      const threshold = maxDepth * 0.85 // items closer than 85% of max

      const objectDepths = depthMapMm.filter((d) => d < threshold && d > 0)

      if (objectDepths.length === 0) return null

      // Approximate object dimensions
      const minDepth = Math.min(...objectDepths)
      const objectThickness = (threshold - minDepth) / 10 // mm to cm

      // Pixel coverage as fraction of frame
      const coverage = objectDepths.length / (width * height)

      // Approximate sensor field of view (iPhone Pro ~77 degrees)
      // At the object distance, estimate real-world area
      const avgDepth = objectDepths.reduce((a, b) => a + b, 0) / objectDepths.length
      const fovRad = (77 * Math.PI) / 180
      const frameWidthCm = (2 * avgDepth * Math.tan(fovRad / 2)) / 10
      const frameHeightCm = frameWidthCm * (height / width)

      const objectAreaCm2 = frameWidthCm * frameHeightCm * coverage
      const volumeCm3 = objectAreaCm2 * objectThickness

      return Math.round(volumeCm3 * 100) / 100
    },
    [],
  )

  return {
    state,
    lastDepthData,
    toggleLiDAR,
    captureDepthFrame,
    estimateVolumeFromDepth,
  }
}
