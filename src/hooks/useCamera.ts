// ─────────────────────────────────────────────────────────────
// useCamera.ts — expo-camera hook for capturing produce photos
// ─────────────────────────────────────────────────────────────

import { useRef, useState, useCallback, useEffect } from 'react'
import { CameraView, useCameraPermissions } from 'expo-camera'

// ── Types ────────────────────────────────────────────────────

export type CameraPhase =
  | 'idle'
  | 'permission_check'
  | 'camera_mounting'
  | 'camera_ready'
  | 'error'

export interface CameraState {
  isReady: boolean
  hasPermission: boolean | null
  isCapturing: boolean
  error: string | null
  phase: CameraPhase
  mountError: string | null
}

export interface CapturedPhoto {
  uri: string
  base64: string
  width: number
  height: number
}

const CAMERA_READY_TIMEOUT_MS = 10000

// ── Hook ─────────────────────────────────────────────────────

export function useCamera() {
  const cameraRef = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [state, setState] = useState<CameraState>({
    isReady: false,
    hasPermission: null,
    isCapturing: false,
    error: null,
    phase: 'idle',
    mountError: null,
  })

  // Clear any pending ready timeout on unmount
  useEffect(() => {
    return () => {
      if (readyTimerRef.current) {
        clearTimeout(readyTimerRef.current)
        readyTimerRef.current = null
      }
    }
  }, [])

  // Request camera permission
  const requestAccess = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, phase: 'permission_check' }))
    try {
      const result = await requestPermission()
      const granted = result.granted
      if (granted) {
        setState((prev) => ({
          ...prev,
          hasPermission: true,
          error: null,
          phase: 'camera_mounting',
        }))
      } else {
        setState((prev) => ({
          ...prev,
          hasPermission: false,
          phase: 'error',
        }))
      }
      return granted
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Permission request failed'
      setState((prev) => ({
        ...prev,
        error: message,
        phase: 'error',
      }))
      return false
    }
  }, [requestPermission])

  // Camera ready callback — native camera reports readiness
  const onCameraReady = useCallback(() => {
    if (readyTimerRef.current) {
      clearTimeout(readyTimerRef.current)
      readyTimerRef.current = null
    }
    setState((prev) => ({
      ...prev,
      isReady: true,
      phase: 'camera_ready',
      mountError: null,
    }))
  }, [])

  // Camera mount error callback — native camera failed to start
  const onMountError = useCallback((event: { message: string }) => {
    if (readyTimerRef.current) {
      clearTimeout(readyTimerRef.current)
      readyTimerRef.current = null
    }
    const message = event?.message || 'Camera could not be started'
    setState((prev) => ({
      ...prev,
      isReady: false,
      phase: 'error',
      mountError: message,
      error: message,
    }))
  }, [])

  // Start a timeout when entering camera_mounting phase
  const startReadyTimeout = useCallback(() => {
    if (readyTimerRef.current) {
      clearTimeout(readyTimerRef.current)
    }
    readyTimerRef.current = setTimeout(() => {
      setState((prev) => {
        if (prev.phase === 'camera_mounting') {
          return {
            ...prev,
            isReady: false,
            phase: 'error',
            mountError: 'Camera initialization timed out. Please try again.',
            error: 'Camera initialization timed out. Please try again.',
          }
        }
        return prev
      })
    }, CAMERA_READY_TIMEOUT_MS)
  }, [])

  // Reset camera state for a fresh attempt
  const resetCamera = useCallback(() => {
    if (readyTimerRef.current) {
      clearTimeout(readyTimerRef.current)
      readyTimerRef.current = null
    }
    setState({
      isReady: false,
      hasPermission: null,
      isCapturing: false,
      error: null,
      phase: 'idle',
      mountError: null,
    })
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

  // If the system permission is already granted on mount, transition to mounting
  useEffect(() => {
    if (hasPermission === true && state.phase === 'idle') {
      setState((prev) => ({
        ...prev,
        hasPermission: true,
        phase: 'camera_mounting',
      }))
      startReadyTimeout()
    }
  }, [hasPermission, state.phase, startReadyTimeout])

  return {
    cameraRef,
    hasPermission,
    state: { ...state, hasPermission },
    requestAccess,
    onCameraReady,
    onMountError,
    takePhoto,
    resetCamera,
    startReadyTimeout,
    CAMERA_READY_TIMEOUT_MS,
  }
}
