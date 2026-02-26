// ─────────────────────────────────────────────────────────────
// useCamera.ts — expo-camera hook for capturing produce photos
// ─────────────────────────────────────────────────────────────

import { useRef, useState, useCallback } from 'react'
import { CameraView, useCameraPermissions } from 'expo-camera'

// ── Types ────────────────────────────────────────────────────

export interface CameraState {
  isReady: boolean
  hasPermission: boolean | null
  isCapturing: boolean
  error: string | null
}

export interface CapturedPhoto {
  uri: string
  base64: string
  width: number
  height: number
}

// ── Hook ─────────────────────────────────────────────────────

export function useCamera() {
  const cameraRef = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()

  const [state, setState] = useState<CameraState>({
    isReady: false,
    hasPermission: null,
    isCapturing: false,
    error: null,
  })

  // Request camera permission
  const requestAccess = useCallback(async (): Promise<boolean> => {
    try {
      const result = await requestPermission()
      const granted = result.granted
      setState((prev) => ({ ...prev, hasPermission: granted, error: null }))
      return granted
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Permission request failed'
      setState((prev) => ({ ...prev, error: message }))
      return false
    }
  }, [requestPermission])

  // Camera ready callback
  const onCameraReady = useCallback(() => {
    setState((prev) => ({ ...prev, isReady: true }))
  }, [])

  // Take a photo and return base64
  const takePhoto = useCallback(async (): Promise<CapturedPhoto | null> => {
    if (!cameraRef.current || state.isCapturing) return null

    setState((prev) => ({ ...prev, isCapturing: true, error: null }))

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
        exif: false,
      })

      if (!photo || !photo.base64) {
        setState((prev) => ({ ...prev, isCapturing: false, error: 'No photo data returned' }))
        return null
      }

      setState((prev) => ({ ...prev, isCapturing: false }))

      return {
        uri: photo.uri,
        base64: photo.base64,
        width: photo.width,
        height: photo.height,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Photo capture failed'
      setState((prev) => ({ ...prev, isCapturing: false, error: message }))
      return null
    }
  }, [state.isCapturing])

  // Derive permission status from the permission object
  const hasPermission = permission?.granted ?? null

  return {
    cameraRef,
    hasPermission,
    state: { ...state, hasPermission },
    requestAccess,
    onCameraReady,
    takePhoto,
  }
}
