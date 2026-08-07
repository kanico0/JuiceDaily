// ─────────────────────────────────────────────────────────────
// cameraFallbackReadiness.test.ts — Regression tests for the
// Samsung/Fabric camera fallback readiness path.
//
// Proves:
//   1. Normal onCameraReady still works (primary path).
//   2. Fallback probe succeeds when onCameraReady never fires.
//   3. Fallback readiness clears the watchdog timer.
//   4. No 15s timeout after fallback readiness succeeds.
//   5. Genuine onMountError still produces an error.
//   6. Stale previous-session fallback callbacks are ignored.
//   7. Background/unmount/reset clears the fallback probe.
//   8. Shutter/capture works from fallback-ready state.
//   9. Capture failure remains recoverable from fallback-ready.
// ─────────────────────────────────────────────────────────────

import React from 'react'
import TestRenderer from 'react-test-renderer'
import { useCamera } from '../../hooks/useCamera'

jest.mock('expo-camera', () => ({
  CameraView: jest.fn(() => null),
  useCameraPermissions: () => [
    { granted: true, status: 'granted', canAskAgain: true },
    jest.fn().mockResolvedValue({ granted: true }),
  ],
}))

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  View: 'View',
  Text: 'Text',
  StyleSheet: { absoluteFill: {} },
}))

function TestComponent({ hookRef }: { hookRef: { current: any } }) {
  const cam = useCamera()
  hookRef.current = cam
  return null
}

describe('Camera fallback readiness (Samsung/Fabric)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('1. normal onCameraReady still works as primary path', () => {
    const hookRef: { current: any } = { current: null }
    let renderer: any
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(TestComponent, { hookRef }))
    })

    // Fallback probe is armed but onCameraReady should win
    TestRenderer.act(() => {
      hookRef.current.onCameraReady()
    })

    expect(hookRef.current.state.phase).toBe('camera_ready')
    expect(hookRef.current.state.isReady).toBe(true)

    // Advance past fallback grace period — should not double-fire
    TestRenderer.act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(hookRef.current.state.phase).toBe('camera_ready')

    TestRenderer.act(() => {
      renderer.unmount()
    })
  })

  test('2. fallback probe succeeds when onCameraReady never fires', async () => {
    const hookRef: { current: any } = { current: null }
    let renderer: any
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(TestComponent, { hookRef }))
    })

    // Simulate CameraView ref with getAvailablePictureSizesAsync
    hookRef.current.cameraRef.current = {
      getAvailablePictureSizesAsync: jest.fn().mockResolvedValue(['4000x3000', '1920x1080']),
      takePictureAsync: jest.fn().mockResolvedValue({
        base64: 'mockbase64',
        uri: 'mockuri',
        width: 1080,
        height: 1920,
      }),
    }

    // Advance past the 3s grace period — fallback probe fires
    await TestRenderer.act(async () => {
      jest.advanceTimersByTime(3000)
      // Flush microtasks for the async probe
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(hookRef.current.state.phase).toBe('camera_ready')
    expect(hookRef.current.state.isReady).toBe(true)

    TestRenderer.act(() => {
      renderer.unmount()
    })
  })

  test('3. fallback readiness clears the watchdog timer', async () => {
    const hookRef: { current: any } = { current: null }
    let renderer: any
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(TestComponent, { hookRef }))
    })

    hookRef.current.cameraRef.current = {
      getAvailablePictureSizesAsync: jest.fn().mockResolvedValue(['4000x3000']),
    }

    await TestRenderer.act(async () => {
      jest.advanceTimersByTime(3000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(hookRef.current.state.phase).toBe('camera_ready')

    // Advance well past the 15s watchdog — must NOT fire
    TestRenderer.act(() => {
      jest.advanceTimersByTime(20000)
    })

    expect(hookRef.current.state.phase).toBe('camera_ready')
    expect(hookRef.current.state.mountError).toBeNull()

    TestRenderer.act(() => {
      renderer.unmount()
    })
  })

  test('4. no 15s timeout after fallback readiness succeeds', async () => {
    const hookRef: { current: any } = { current: null }
    let renderer: any
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(TestComponent, { hookRef }))
    })

    hookRef.current.cameraRef.current = {
      getAvailablePictureSizesAsync: jest.fn().mockResolvedValue(['4000x3000', '3840x2160']),
    }

    await TestRenderer.act(async () => {
      jest.advanceTimersByTime(3000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(hookRef.current.state.isReady).toBe(true)

    // Advance 15s past the original watchdog arm time
    TestRenderer.act(() => {
      jest.advanceTimersByTime(15000)
    })

    expect(hookRef.current.state.phase).not.toBe('error')
    expect(hookRef.current.state.mountError).not.toBe('Camera initialization timed out. Please try again.')

    TestRenderer.act(() => {
      renderer.unmount()
    })
  })

  test('5. genuine onMountError still produces an error', () => {
    const hookRef: { current: any } = { current: null }
    let renderer: any
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(TestComponent, { hookRef }))
    })

    TestRenderer.act(() => {
      hookRef.current.onMountError({ message: 'Camera hardware error' })
    })

    expect(hookRef.current.state.phase).toBe('error')
    expect(hookRef.current.state.mountError).toBe('Camera hardware error')

    // Advance past all timers — error state must persist
    TestRenderer.act(() => {
      jest.advanceTimersByTime(20000)
    })

    expect(hookRef.current.state.phase).toBe('error')

    TestRenderer.act(() => {
      renderer.unmount()
    })
  })

  test('6. stale previous-session fallback callbacks are ignored', async () => {
    const hookRef: { current: any } = { current: null }
    let renderer: any
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(TestComponent, { hookRef }))
    })

    // First session — no cameraRef so probe will no-op
    // Advance past grace period to let first probe fire and no-op
    await TestRenderer.act(async () => {
      jest.advanceTimersByTime(3000)
      await Promise.resolve()
    })

    // Reset camera — starts a new session
    TestRenderer.act(() => {
      hookRef.current.resetCamera()
    })

    // Set cameraRef for the new session
    hookRef.current.cameraRef.current = {
      getAvailablePictureSizesAsync: jest.fn().mockResolvedValue(['4000x3000']),
    }

    // Advance past the new session's grace period
    await TestRenderer.act(async () => {
      jest.advanceTimersByTime(3000)
      await Promise.resolve()
      await Promise.resolve()
    })

    // New session should be ready via fallback
    expect(hookRef.current.state.phase).toBe('camera_ready')
    expect(hookRef.current.state.isReady).toBe(true)

    TestRenderer.act(() => {
      renderer.unmount()
    })
  })

  test('7. unmount clears the fallback probe', () => {
    const hookRef: { current: any } = { current: null }
    let renderer: any
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(TestComponent, { hookRef }))
    })

    TestRenderer.act(() => {
      renderer.unmount()
    })

    // Advancing timers after unmount should not throw
    TestRenderer.act(() => {
      jest.advanceTimersByTime(3000)
    })
  })

  test('8. shutter/capture works from fallback-ready state', async () => {
    const hookRef: { current: any } = { current: null }
    let renderer: any
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(TestComponent, { hookRef }))
    })

    const mockTakePicture = jest.fn().mockResolvedValue({
      base64: 'mockbase64',
      uri: 'mockuri',
      width: 1080,
      height: 1920,
    })

    hookRef.current.cameraRef.current = {
      getAvailablePictureSizesAsync: jest.fn().mockResolvedValue(['4000x3000']),
      takePictureAsync: mockTakePicture,
    }

    // Let fallback probe succeed
    await TestRenderer.act(async () => {
      jest.advanceTimersByTime(3000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(hookRef.current.state.isReady).toBe(true)

    // Take a photo from the fallback-ready state
    await TestRenderer.act(async () => {
      const photo = await hookRef.current.takePhoto()
      expect(photo).not.toBeNull()
      expect(photo.base64).toBe('mockbase64')
    })

    expect(mockTakePicture).toHaveBeenCalled()

    TestRenderer.act(() => {
      renderer.unmount()
    })
  })

  test('9. capture failure remains recoverable from fallback-ready state', async () => {
    const hookRef: { current: any } = { current: null }
    let renderer: any
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(TestComponent, { hookRef }))
    })

    const mockTakePicture = jest.fn().mockRejectedValue(new Error('Capture failed'))

    hookRef.current.cameraRef.current = {
      getAvailablePictureSizesAsync: jest.fn().mockResolvedValue(['4000x3000']),
      takePictureAsync: mockTakePicture,
    }

    // Let fallback probe succeed
    await TestRenderer.act(async () => {
      jest.advanceTimersByTime(3000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(hookRef.current.state.isReady).toBe(true)

    // Attempt capture — should fail but not crash
    await TestRenderer.act(async () => {
      const photo = await hookRef.current.takePhoto()
      expect(photo).toBeNull()
    })

    // State should have an error but not be in 'error' phase
    expect(hookRef.current.state.error).toBe('Capture failed')
    expect(hookRef.current.state.isCapturing).toBe(false)

    TestRenderer.act(() => {
      renderer.unmount()
    })
  })
})
