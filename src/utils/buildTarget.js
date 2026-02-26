// ─────────────────────────────────────────────────────────────
// buildTarget.js — Runtime build target flag
//
// APP_BUILD_TARGET = "go" | "beta"
//   go   → Expo Go compatible (expo-camera only, no native modules)
//   beta → Dev client build (vision-camera, LiDAR, native modules)
//
// Set via EXPO_PUBLIC_BUILD_TARGET env var.
// Defaults to "go" so Expo Go works out of the box.
// ─────────────────────────────────────────────────────────────

const raw = process.env.EXPO_PUBLIC_BUILD_TARGET

export const BUILD_TARGET = raw === 'beta' ? 'beta' : 'go'

export const isGoMode = BUILD_TARGET === 'go'
export const isBetaMode = BUILD_TARGET === 'beta'
