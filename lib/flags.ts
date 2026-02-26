// ─────────────────────────────────────────────────────────────
// lib/flags.ts — Environment flags for Expo Go vs Dev Build
// Defaults to mock camera (true) so Expo Go works out of the box.
// Set EXPO_PUBLIC_USE_MOCK_CAMERA=false in .env for real camera.
// ─────────────────────────────────────────────────────────────

const raw = process.env.EXPO_PUBLIC_USE_MOCK_CAMERA

export const USE_MOCK_CAMERA: boolean =
  raw === undefined || raw === '' || raw === 'true'
