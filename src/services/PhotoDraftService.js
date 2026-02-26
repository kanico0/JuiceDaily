// ─────────────────────────────────────────────────────────────
// PhotoDraftService.js — Photo-to-draft juice log flow
// Camera permission requested IN-CONTEXT only (never at launch).
// Creates a draft log from a photo for user review before saving.
// Gated behind ff_photo_draft feature flag.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'
import { trackEvent } from './AnalyticsService'

const DRAFTS_KEY = '@juicing_photo_drafts_v1'

// ── Draft Management ─────────────────────────────────────────

export async function saveDraft(draft) {
  try {
    const raw = await AsyncStorage.getItem(DRAFTS_KEY)
    const drafts = raw ? JSON.parse(raw) : []
    const newDraft = {
      id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      status: 'pending_review',
      photoUri: draft.photoUri || null,
      detectedIngredients: draft.detectedIngredients || [],
      suggestedVolume: draft.suggestedVolume || 'medium',
      confidence: draft.confidence || 0,
      userEdited: false,
    }
    drafts.unshift(newDraft)
    // Keep max 20 drafts
    const trimmed = drafts.slice(0, 20)
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(trimmed))

    trackEvent('photo_draft_created', {
      draft_id_opaque: newDraft.id,
      ingredient_count: newDraft.detectedIngredients.length,
      confidence_bucket: Math.round(newDraft.confidence * 10) / 10,
      source: 'camera',
    })

    return newDraft
  } catch (e) {
    return null
  }
}

export async function getDrafts() {
  try {
    const raw = await AsyncStorage.getItem(DRAFTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

export async function getDraft(draftId) {
  const drafts = await getDrafts()
  return drafts.find((d) => d.id === draftId) || null
}

export async function updateDraft(draftId, updates) {
  try {
    const raw = await AsyncStorage.getItem(DRAFTS_KEY)
    const drafts = raw ? JSON.parse(raw) : []
    const updated = drafts.map((d) =>
      d.id === draftId ? { ...d, ...updates, userEdited: true } : d
    )
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(updated))
    return updated.find((d) => d.id === draftId) || null
  } catch (e) {
    return null
  }
}

export async function deleteDraft(draftId) {
  try {
    const raw = await AsyncStorage.getItem(DRAFTS_KEY)
    const drafts = raw ? JSON.parse(raw) : []
    const filtered = drafts.filter((d) => d.id !== draftId)
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(filtered))
    return true
  } catch (e) {
    return false
  }
}

export async function confirmDraft(draftId) {
  try {
    const raw = await AsyncStorage.getItem(DRAFTS_KEY)
    const drafts = raw ? JSON.parse(raw) : []
    const draft = drafts.find((d) => d.id === draftId)
    if (!draft) return null

    // Mark as confirmed and return the draft data for logging
    const updated = drafts.map((d) =>
      d.id === draftId ? { ...d, status: 'confirmed', confirmedAt: new Date().toISOString() } : d
    )
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(updated))

    return {
      scannedIngredients: draft.detectedIngredients.map((ing) => ({
        produceId: ing.produceId,
        weightG: ing.weightG || 150,
        isOrganic: false,
      })),
      volume: draft.suggestedVolume,
      source: 'photo_draft',
      draftId: draft.id,
    }
  } catch (e) {
    return null
  }
}

// ── Camera Permission Helper ─────────────────────────────────
// Permission is requested IN-CONTEXT only when user initiates
// the photo flow. Never requested at app launch.

export async function requestCameraPermission() {
  try {
    const { Camera } = require('expo-camera')
    const { status } = await Camera.requestCameraPermissionsAsync()
    return status === 'granted'
  } catch (e) {
    return false
  }
}

export async function checkCameraPermission() {
  try {
    const { Camera } = require('expo-camera')
    const { status } = await Camera.getCameraPermissionsAsync()
    return status === 'granted'
  } catch (e) {
    return false
  }
}
