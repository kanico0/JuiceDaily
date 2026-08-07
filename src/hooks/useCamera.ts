// ─────────────────────────────────────────────────────────────
// useCamera.ts — expo-camera hook for capturing produce photos
// ─────────────────────────────────────────────────────────────

import { useRef, useState, useCallback, useEffect } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'

// ── Types ────────────────────────────────────────────────────

export type CameraPhase = 'idle' | 'permission_check' | 'camera_mounting' | 'camera_ready' | 'error'

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

const CAMERA_READY_TIMEOUT_MS = 15000

// ── Hook ─────────────────────────────────────────────────────

export function useCamera() {
  const cameraRef = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionRef = useRef(0)

  const [state, setState] = useState<CameraState>({
    isReady: false,
    hasPermission: null,
    isCapturing: false,
    error: null,
    phase: 'idle',
    mountError: null,
  })

  const clearReadyTimer = useCallback(() => {
    if (readyTimerRef.current) {
      clearTimeout(readyTimerRef.current)
      readyTimerRef.current = null
    }
  }, [])

  // Clear any pending ready timeout on unmount
  useEffect(() => {
    return () => {
      clearReadyTimer()
    }
  }, [clearReadyTimer])

  // Clear timer when app goes to background
  useEffect(() => {
    const handler = (e: AppStateStatus) => {
      if (e !== 'active') {
        clearReadyTimer()
      }
    }
    const sub = AppState.addEventListener('change', handler)
    return () => {
      sub.remove()
    }
  }, [clearReadyTimer])

  // Start a timeout when entering camera_mounting phase.
  // The timer is tied to a session ID so that an old timer
  // cannot report failure against a newer camera session.
  const startReadyTimeout = useCallback(() => {
    clearReadyTimer()
    const session = sessionRef.current
    readyTimerRef.current = setTimeout(() => {
      // Ignore if a newer session has started
      if (session !== sessionRef.current) return
      setState((prev) => {
        // Only fire if still in mounting phase — if the camera
        // became ready or capture started, the timer should have
        // been cleared already. This is a defensive check.
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
  }, [clearReadyTimer])

  // Request camera permission
  const requestAccess = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, phase: 'permission_check' }))
    try {
      const result = await requestPermission()
      const granted = result.granted
      if (granted) {
        sessionRef.current += 1
        setState((prev) => ({
          ...prev,
          hasPermission: true,
          error: null,
          phase: 'camera_mounting',
        }))
        startReadyTimeout()
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
  }, [requestPermission, startReadyTimeout])

  // Camera ready callback — native camera reports readiness.
  // Cancels the initialization timer for this session.
  const onCameraReady = useCallback(() => {
    clearReadyTimer()
    setState((prev) => ({
      ...prev,
      isReady: true,
      phase: 'camera_ready',
      mountError: null,
    }))
  }, [clearReadyTimer])

  // Camera mount error callback — native camera failed to start
  const onMountError = useCallback(
    (event: { message: string }) => {
      clearReadyTimer()
      const message = event?.message || 'Camera could not be started'
      setState((prev) => ({
        ...prev,
        isReady: false,
        phase: 'error',
        mountError: message,
        error: message,
      }))
    },
    [clearReadyTimer],
  )

  // Reset camera state for a fresh attempt.
  // Increments the session ID so any pending timer from the
  // previous session is invalidated.
  const resetCamera = useCallback(() => {
    clearReadyTimer()
    sessionRef.current += 1
    setState({
      isReady: false,
      hasPermission: null,
      isCapturing: false,
      error: null,
      phase: 'idle',
      mountError: null,
    })
  }, [clearReadyTimer])

  // Take a photo and return base64.
  // Defensively cancels the initialization timer when capture
  // begins — the camera is clearly ready if we can capture.
  const takePhoto = useCallback(async (): Promise<CapturedPhoto | null> => {
    if (!cameraRef.current || state.isCapturing) return null

    // Cancel any pending initialization timer — capture cannot
    // begin unless the camera is ready.
    clearReadyTimer()

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
  }, [state.isCapturing, clearReadyTimer])

  // Derive permission status from the permission object
  const hasPermission = permission?.granted ?? null

  // If the system permission is already granted on mount, transition to mounting
  useEffect(() => {
    if (hasPermission === true && state.phase === 'idle') {
      sessionRef.current += 1
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
  }
}
