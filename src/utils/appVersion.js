// ─────────────────────────────────────────────────────────────
// appVersion.js — App version display constant
//
// Used by SettingsScreen for the version display that doubles
// as the hidden developer mode unlock gesture target.
// ─────────────────────────────────────────────────────────────

// eslint-disable-next-line import/no-unresolved
import appJson from '../../../app.json'

export const APP_VERSION = appJson.expo.version || '1.0.0'
export const APP_VERSION_CODE = appJson.expo.android?.versionCode || 1
