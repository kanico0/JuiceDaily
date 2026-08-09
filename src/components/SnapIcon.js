// SnapIcon.js — Shared RawLifeFlow Snap-action icon
// Renders the approved Raw_LifeFlow_Camera_Icon.png asset at any size.
// Used by all Snap/camera-action entry points (buttons, CTAs, FAB).
// NOT used for: flash, flip, gallery, permission graphics, marketing,
// launcher icon, or decorative camera artwork.
//
// IMPORTANT: The approved artwork is a full-color branded PNG.
// Do NOT apply tintColor — that would turn it into a monochrome
// silhouette and destroy the recognizable artwork.
// For disabled/exhausted states, reduce opacity via the `disabled`
// prop or pass an explicit `style` with opacity.

import React from 'react'
import { Image, StyleSheet } from 'react-native'

const SNAP_ICON_ASSET = require('../../assets/Raw_LifeFlow_Camera_Icon.png')

export default function SnapIcon({ size = 24, color = null, style, resizeMode = 'contain', disabled = false }) {
  // Render the full-color artwork as-is. Never apply tintColor —
  // the approved PNG has its own colors that must be preserved.
  // The `color` prop is accepted for API compatibility but ignored
  // (the artwork is always full-color). Callers that previously
  // relied on a white monochrome glyph should instead use the
  // full-color artwork on a contrasting background.
  const baseStyle = {
    width: size,
    height: size,
    opacity: disabled ? 0.35 : 1,
  }

  return (
    <Image
      source={SNAP_ICON_ASSET}
      style={[styles.base, baseStyle, style]}
      resizeMode={resizeMode}
      accessibilityLabel="RawLifeFlow snap icon"
    />
  )
}

const styles = StyleSheet.create({
  base: {
    // contain-style rendering — no stretch, no crop
  },
})
