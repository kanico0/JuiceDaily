// SnapIcon.js — Shared RawLifeFlow Snap-action icon
// Renders the approved Raw_LifeFlow_Camera_Icon.png asset at any size.
// Used by all Snap/camera-action entry points (buttons, CTAs, FAB).
// NOT used for: flash, flip, gallery, permission graphics, marketing,
// launcher icon, or decorative camera artwork.

import React from 'react'
import { Image, StyleSheet } from 'react-native'

const SNAP_ICONAsset = require('../../assets/Raw_LifeFlow_Camera_Icon.png')

// Default tint for white-on-gradient contexts (most Snap CTAs).
// Pass `null` to render the asset as-is (full-color branded icon).
export default function SnapIcon({ size = 24, color = '#FFFFFF', style, resizeMode = 'contain' }) {
  // When a tint color is requested, render the image with tintColor so it
  // matches the previous lucide Camera glyph appearance on gradient buttons.
  // When color is null, render the full-color branded artwork.
  const tintStyle = color
    ? { tintColor: color, width: size, height: size }
    : { width: size, height: size }

  return (
    <Image
      source={SNAP_ICONAsset}
      style={[styles.base, tintStyle, style]}
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
