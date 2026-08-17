// ─────────────────────────────────────────────────────────────
// GardenPreviewScreen.js — TEMPORARY QA-ONLY visual preview harness
//
// THIS FILE IS NOT FOR COMMIT. It is a developer-only tool for
// physically inspecting representative developed Living Garden
// states on a QA device without writing any persistent user data.
//
// It imports ONLY:
//   - LivingGardenScene (the existing renderer)
//   - React/React Native primitives
//
// It does NOT import:
//   - JuiceLogStore / JuiceLog
//   - gardenService
//   - gardenSeenState
//   - achievements storage
//   - glowJourneyService
//   - AsyncStorage
//   - Supabase
//   - RevenueCat
//   - identity / storage helpers
//
// It reads and writes NO persistent user data.
//
// FIT mode: measures available area and scales the entire 390×720
// scene to fit without cropping. All 7 beds visible simultaneously.
//
// Motion QA: Normal/Reduced toggle + transition scenario triggers.
// Synthetic advancements objects are constructed in-preview and
// passed to the Scene's motion orchestration. No persistence.
// ─────────────────────────────────────────────────────────────

import React, { useState, useCallback, Component, useMemo, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { LivingGardenScene } from '../components/LivingGardenScene'
import { LivingGardenSpotlight } from '../components/LivingGardenSpotlight'
import {
  V5HeroOverlay,
  HERO_SCALE_PRESETS as V5_HERO_SCALE_PRESETS,
  LOCAL_ROSETTE_SCALE_PRESETS as V5_LOCAL_ROSETTE_SCALE_PRESETS,
  DEFAULT_SCALE_PRESET as V5_DEFAULT_SCALE_PRESET,
  PRESET_LABELS as V5_PRESET_LABELS,
  HERO_HORIZONTAL_SCALE as V5_HERO_HORIZONTAL_SCALE,
  HERO_VERTICAL_SCALE as V5_HERO_VERTICAL_SCALE,
  ROOT_SPREAD_SCALE_PEAK as V5_ROOT_SPREAD_SCALE_PEAK,
  CANONICAL_ROOT_SPREAD as V5_CANONICAL_ROOT_SPREAD,
  ROSETTE_FOLIAGE_W as V5_ROSETTE_FOLIAGE_W,
  ROSETTE_FOLIAGE_H as V5_ROSETTE_FOLIAGE_H,
  LARGEST_LEAF_LENGTH_CANONICAL as V5_LARGEST_LEAF_LENGTH,
  LARGEST_LEAF_WIDTH_CANONICAL as V5_LARGEST_LEAF_WIDTH,
  GARDEN_VIEWPORT_W as V5_GARDEN_VIEWPORT_W,
  GARDEN_VIEWPORT_H as V5_GARDEN_VIEWPORT_H,
  GREENS_CX as V5_GREENS_CX,
  GREENS_CY as V5_GREENS_CY,
  HANDOFF_BLADE_COUNT as V5_HANDOFF_BLADE_COUNT,
  TEMPORARY_BLADE_COUNT as V5_TEMPORARY_BLADE_COUNT,
  PRIMARY_BLADE_COUNT as V5_PRIMARY_BLADE_COUNT,
  SUBORDINATE_BLADE_COUNT as V5_SUBORDINATE_BLADE_COUNT,
  TOTAL_HERO_BLADES as V5_TOTAL_HERO_BLADES,
  calculateVisibleOccupancy as v5CalculateVisibleOccupancy,
  computeHeroBBoxSvg as v5ComputeHeroBBoxSvg,
  computeVisibleIntersection as v5ComputeVisibleIntersection,
} from '../components/LivingGardenBedV5MergeProofCalibration'

// ── Valid canonical stage keys (mirrors gardenService, not imported) ──
const VALID_BED_STAGES = ['empty', 'seed', 'sprout', 'growing', 'harvesting', 'flourishing']
const VALID_JOURNEY_KEYS = [
  null,
  'seed',
  'sprout',
  'growing',
  'blooming',
  'thriving',
  'radiant',
  'legend',
]

// ── Scene dimensions (matches LivingGardenGeometry) ──────────
const SCENE_WIDTH = 390
const SCENE_HEIGHT = 720

// ── Preset definitions ────────────────────────────────────────
// Each preset feeds synthetic canonical renderer props directly
// into LivingGardenScene. No derivation, no persistence.

const PRESETS = [
  {
    key: 'early',
    name: 'Early Garden',
    bedStages: {
      greens: { key: 'sprout', label: 'Sprout' },
      roots: { key: 'seed', label: 'Seed' },
      citrus: { key: 'empty', label: 'Empty' },
      orchard: { key: 'empty', label: 'Empty' },
      berries: { key: 'seed', label: 'Seed' },
      tropical: { key: 'empty', label: 'Empty' },
      herbs: { key: 'sprout', label: 'Sprout' },
    },
    journeyStageKey: 'seed',
    arborCtx: {
      unlockedAchievementIds: ['first_juice'],
      bedStages: {
        greens: { key: 'sprout' },
        roots: { key: 'seed' },
        citrus: { key: 'empty' },
        orchard: { key: 'empty' },
        berries: { key: 'seed' },
        tropical: { key: 'empty' },
        herbs: { key: 'sprout' },
      },
      rainbowComplete: false,
    },
  },
  {
    key: 'oneMonth',
    name: 'One-Month Garden',
    bedStages: {
      greens: { key: 'harvesting', label: 'Harvesting' },
      roots: { key: 'growing', label: 'Growing' },
      citrus: { key: 'sprout', label: 'Sprout' },
      orchard: { key: 'growing', label: 'Growing' },
      berries: { key: 'harvesting', label: 'Harvesting' },
      tropical: { key: 'seed', label: 'Seed' },
      herbs: { key: 'flourishing', label: 'Flourishing' },
    },
    journeyStageKey: 'growing',
    arborCtx: {
      unlockedAchievementIds: ['first_juice', 'streak_3', 'streak_7', 'logs_10'],
      bedStages: {
        greens: { key: 'harvesting' },
        roots: { key: 'growing' },
        citrus: { key: 'sprout' },
        orchard: { key: 'growing' },
        berries: { key: 'harvesting' },
        tropical: { key: 'seed' },
        herbs: { key: 'flourishing' },
      },
      rainbowComplete: false,
    },
  },
  {
    key: 'established',
    name: 'Established Garden',
    bedStages: {
      greens: { key: 'flourishing', label: 'Flourishing' },
      roots: { key: 'flourishing', label: 'Flourishing' },
      citrus: { key: 'harvesting', label: 'Harvesting' },
      orchard: { key: 'flourishing', label: 'Flourishing' },
      berries: { key: 'flourishing', label: 'Flourishing' },
      tropical: { key: 'growing', label: 'Growing' },
      herbs: { key: 'flourishing', label: 'Flourishing' },
    },
    journeyStageKey: 'thriving',
    arborCtx: {
      unlockedAchievementIds: ['first_juice', 'streak_3', 'streak_7', 'logs_10'],
      bedStages: {
        greens: { key: 'flourishing' },
        roots: { key: 'flourishing' },
        citrus: { key: 'harvesting' },
        orchard: { key: 'flourishing' },
        berries: { key: 'flourishing' },
        tropical: { key: 'growing' },
        herbs: { key: 'flourishing' },
      },
      rainbowComplete: false,
    },
  },
  {
    key: 'legend',
    name: 'Legend Garden',
    bedStages: {
      greens: { key: 'flourishing', label: 'Flourishing' },
      roots: { key: 'flourishing', label: 'Flourishing' },
      citrus: { key: 'flourishing', label: 'Flourishing' },
      orchard: { key: 'flourishing', label: 'Flourishing' },
      berries: { key: 'flourishing', label: 'Flourishing' },
      tropical: { key: 'flourishing', label: 'Flourishing' },
      herbs: { key: 'flourishing', label: 'Flourishing' },
    },
    journeyStageKey: 'legend',
    arborCtx: {
      unlockedAchievementIds: ['first_juice', 'streak_3', 'streak_7', 'logs_10'],
      bedStages: {
        greens: { key: 'flourishing' },
        roots: { key: 'flourishing' },
        citrus: { key: 'flourishing' },
        orchard: { key: 'flourishing' },
        berries: { key: 'flourishing' },
        tropical: { key: 'flourishing' },
        herbs: { key: 'flourishing' },
      },
      rainbowComplete: true,
    },
  },
  // ── V6 Canonical Delta presets (GATE 1.1) ──
  // Isolated Greens-only comparison: Growing vs Harvesting at canonical 1.0x.
  // All other beds empty so the eye focuses on the Greens delta.
  {
    key: 'v6-growing',
    name: 'V6 Delta: Growing',
    bedStages: {
      greens: { key: 'growing', label: 'Growing' },
      roots: { key: 'empty', label: 'Empty' },
      citrus: { key: 'empty', label: 'Empty' },
      orchard: { key: 'empty', label: 'Empty' },
      berries: { key: 'empty', label: 'Empty' },
      tropical: { key: 'empty', label: 'Empty' },
      herbs: { key: 'empty', label: 'Empty' },
    },
    journeyStageKey: 'seed',
    arborCtx: {
      unlockedAchievementIds: [],
      bedStages: {
        greens: { key: 'growing' },
        roots: { key: 'empty' },
        citrus: { key: 'empty' },
        orchard: { key: 'empty' },
        berries: { key: 'empty' },
        tropical: { key: 'empty' },
        herbs: { key: 'empty' },
      },
      rainbowComplete: false,
    },
  },
  {
    key: 'v6-harvest',
    name: 'V6 Delta: Harvest',
    bedStages: {
      greens: { key: 'harvesting', label: 'Harvesting' },
      roots: { key: 'empty', label: 'Empty' },
      citrus: { key: 'empty', label: 'Empty' },
      orchard: { key: 'empty', label: 'Empty' },
      berries: { key: 'empty', label: 'Empty' },
      tropical: { key: 'empty', label: 'Empty' },
      herbs: { key: 'empty', label: 'Empty' },
    },
    journeyStageKey: 'seed',
    arborCtx: {
      unlockedAchievementIds: [],
      bedStages: {
        greens: { key: 'harvesting' },
        roots: { key: 'empty' },
        citrus: { key: 'empty' },
        orchard: { key: 'empty' },
        berries: { key: 'empty' },
        tropical: { key: 'empty' },
        herbs: { key: 'empty' },
      },
      rainbowComplete: false,
    },
  },
  // ── V6 Roots Spotlight presets ──
  // Isolated Roots-only comparison: Growing vs Harvesting at canonical 1.0x.
  {
    key: 'v6-roots-growing',
    name: 'V6 Roots: Growing',
    bedStages: {
      greens: { key: 'empty', label: 'Empty' },
      roots: { key: 'growing', label: 'Growing' },
      citrus: { key: 'empty', label: 'Empty' },
      orchard: { key: 'empty', label: 'Empty' },
      berries: { key: 'empty', label: 'Empty' },
      tropical: { key: 'empty', label: 'Empty' },
      herbs: { key: 'empty', label: 'Empty' },
    },
    journeyStageKey: 'seed',
    arborCtx: {
      unlockedAchievementIds: [],
      bedStages: {
        greens: { key: 'empty' },
        roots: { key: 'growing' },
        citrus: { key: 'empty' },
        orchard: { key: 'empty' },
        berries: { key: 'empty' },
        tropical: { key: 'empty' },
        herbs: { key: 'empty' },
      },
      rainbowComplete: false,
    },
  },
  {
    key: 'v6-roots-harvest',
    name: 'V6 Roots: Harvest',
    bedStages: {
      greens: { key: 'empty', label: 'Empty' },
      roots: { key: 'harvesting', label: 'Harvesting' },
      citrus: { key: 'empty', label: 'Empty' },
      orchard: { key: 'empty', label: 'Empty' },
      berries: { key: 'empty', label: 'Empty' },
      tropical: { key: 'empty', label: 'Empty' },
      herbs: { key: 'empty', label: 'Empty' },
    },
    journeyStageKey: 'seed',
    arborCtx: {
      unlockedAchievementIds: [],
      bedStages: {
        greens: { key: 'empty' },
        roots: { key: 'harvesting' },
        citrus: { key: 'empty' },
        orchard: { key: 'empty' },
        berries: { key: 'empty' },
        tropical: { key: 'empty' },
        herbs: { key: 'empty' },
      },
      rainbowComplete: false,
    },
  },
  // ── V6 Spotlight presets for remaining 5 beds ──
  // Each bed isolated: Growing vs Harvesting at canonical 1.0x.
  ...['citrus', 'orchard', 'tropical', 'berries', 'herbs'].flatMap((bedKey) => [
    {
      key: `v6-${bedKey}-growing`,
      name: `V6 ${bedKey.charAt(0).toUpperCase() + bedKey.slice(1)}: Growing`,
      bedStages: Object.fromEntries(
        ['greens', 'roots', 'citrus', 'orchard', 'berries', 'tropical', 'herbs'].map((k) => [
          k,
          { key: k === bedKey ? 'growing' : 'empty', label: k === bedKey ? 'Growing' : 'Empty' },
        ]),
      ),
      journeyStageKey: 'seed',
      arborCtx: {
        unlockedAchievementIds: [],
        bedStages: Object.fromEntries(
          ['greens', 'roots', 'citrus', 'orchard', 'berries', 'tropical', 'herbs'].map((k) => [
            k,
            { key: k === bedKey ? 'growing' : 'empty' },
          ]),
        ),
        rainbowComplete: false,
      },
    },
    {
      key: `v6-${bedKey}-harvest`,
      name: `V6 ${bedKey.charAt(0).toUpperCase() + bedKey.slice(1)}: Harvest`,
      bedStages: Object.fromEntries(
        ['greens', 'roots', 'citrus', 'orchard', 'berries', 'tropical', 'herbs'].map((k) => [
          k,
          { key: k === bedKey ? 'harvesting' : 'empty', label: k === bedKey ? 'Harvesting' : 'Empty' },
        ]),
      ),
      journeyStageKey: 'seed',
      arborCtx: {
        unlockedAchievementIds: [],
        bedStages: Object.fromEntries(
          ['greens', 'roots', 'citrus', 'orchard', 'berries', 'tropical', 'herbs'].map((k) => [
            k,
            { key: k === bedKey ? 'harvesting' : 'empty' },
          ]),
        ),
        rainbowComplete: false,
      },
    },
  ]),
]

// ── Transition scenarios for motion QA ────────────────────────
// Each scenario creates a synthetic advancements object that
// triggers the Scene's motion orchestration. No persistence.
//
// FLOW (Phase 1C fix):
//   1. Press button → show SOURCE preset (user sees starting state)
//   2. After SOURCE_DISPLAY_MS → switch to TARGET preset + pass advancement
//   3. Motion hook sets starting values (scale=0.25, opacity=0.5)
//   4. Motion animates from compressed/transparent to canonical
//   5. User sees real growth/unfurl/produce/color choreography
//   6. Terminal state = TARGET canonical state
//
// The TARGET preset is computed by applying the advancement's toStage
// to the source preset's bed stages. This mirrors production: the Scene
// renders the DESTINATION state, and the motion hook animates from a
// compressed/transparent version toward canonical.

// Duration to show the source state before triggering the transition.
// Long enough for the user to see the starting state, short enough to
// feel responsive.
const SOURCE_DISPLAY_MS = 800

// Helper: compute the target preset from a source preset + advancements.
// Applies toStage to the relevant beds, updates journey stage if needed,
// and updates arbor context if new milestones are earned.
function computeTargetPreset(sourcePreset, advancements) {
  const targetBedStages = { ...sourcePreset.bedStages }
  if (advancements.bedAdvancements) {
    advancements.bedAdvancements.forEach((adv) => {
      const label = adv.toStage.charAt(0).toUpperCase() + adv.toStage.slice(1)
      targetBedStages[adv.bedKey] = { key: adv.toStage, label }
    })
  }
  let targetJourney = sourcePreset.journeyStageKey
  if (advancements.journeyAdvancement) {
    targetJourney = advancements.journeyAdvancement.toStage
  }
  let targetArborCtx = sourcePreset.arborCtx
  if (advancements.newMilestoneIds && advancements.newMilestoneIds.length > 0) {
    const existing = new Set(sourcePreset.arborCtx.unlockedAchievementIds || [])
    advancements.newMilestoneIds.forEach((id) => existing.add(id))
    targetArborCtx = {
      ...sourcePreset.arborCtx,
      unlockedAchievementIds: Array.from(existing),
      bedStages: targetBedStages,
      rainbowComplete: advancements.rainbowComplete || sourcePreset.arborCtx.rainbowComplete,
    }
  } else if (advancements.rainbowComplete) {
    targetArborCtx = {
      ...sourcePreset.arborCtx,
      bedStages: targetBedStages,
      rainbowComplete: true,
    }
  } else {
    // Update bed stages in arbor context to match
    targetArborCtx = {
      ...sourcePreset.arborCtx,
      bedStages: targetBedStages,
    }
  }
  return {
    ...sourcePreset,
    key: `${sourcePreset.key}-target`,
    name: `${sourcePreset.name} → Target`,
    bedStages: targetBedStages,
    journeyStageKey: targetJourney,
    arborCtx: targetArborCtx,
  }
}

const TRANSITION_SCENARIOS = [
  {
    key: 'emptyToSeed',
    name: 'Empty→Seed',
    presetIdx: 0,
    advancements: {
      isFirstOpen: false,
      bedAdvancements: [{ bedKey: 'citrus', fromStage: 'empty', toStage: 'seed' }],
      journeyAdvancement: null,
      newMilestoneIds: [],
      rainbowComplete: false,
    },
  },
  {
    key: 'seedToSprout',
    name: 'Seed→Sprout',
    presetIdx: 0,
    advancements: {
      isFirstOpen: false,
      bedAdvancements: [{ bedKey: 'roots', fromStage: 'seed', toStage: 'sprout' }],
      journeyAdvancement: null,
      newMilestoneIds: [],
      rainbowComplete: false,
    },
  },
  {
    key: 'growingToHarvesting',
    name: 'Growing→Harvest',
    presetIdx: 1,
    advancements: {
      isFirstOpen: false,
      bedAdvancements: [{ bedKey: 'roots', fromStage: 'growing', toStage: 'harvesting' }],
      journeyAdvancement: null,
      newMilestoneIds: [],
      rainbowComplete: false,
    },
  },
  {
    key: 'harvestingToFlourishing',
    name: 'Harvest→Flourish',
    presetIdx: 1,
    advancements: {
      isFirstOpen: false,
      bedAdvancements: [{ bedKey: 'greens', fromStage: 'harvesting', toStage: 'flourishing' }],
      journeyAdvancement: null,
      newMilestoneIds: [],
      rainbowComplete: false,
    },
  },
  {
    key: 'journeyAdvance',
    name: 'Journey Tree',
    // Self-contained source preset: journeyStageKey='seed' matches fromStage='seed'.
    // Does NOT depend on any PRESETS entry — scenario owns its source state.
    sourcePreset: {
      key: 'journey-source',
      name: 'Journey Source (Seed)',
      bedStages: {
        greens: { key: 'sprout', label: 'Sprout' },
        roots: { key: 'seed', label: 'Seed' },
        citrus: { key: 'empty', label: 'Empty' },
        orchard: { key: 'empty', label: 'Empty' },
        berries: { key: 'seed', label: 'Seed' },
        tropical: { key: 'empty', label: 'Empty' },
        herbs: { key: 'sprout', label: 'Sprout' },
      },
      journeyStageKey: 'seed',
      arborCtx: {
        unlockedAchievementIds: ['first_juice'],
        bedStages: {
          greens: { key: 'sprout' },
          roots: { key: 'seed' },
          citrus: { key: 'empty' },
          orchard: { key: 'empty' },
          berries: { key: 'seed' },
          tropical: { key: 'empty' },
          herbs: { key: 'sprout' },
        },
        rainbowComplete: false,
      },
    },
    advancements: {
      isFirstOpen: false,
      bedAdvancements: [],
      journeyAdvancement: { fromStage: 'seed', toStage: 'growing' },
      newMilestoneIds: [],
      rainbowComplete: false,
    },
  },
  {
    key: 'arborNew',
    name: 'Arbor New',
    // Self-contained source: only 'first_juice' unlocked.
    // newMilestoneIds will add streak_3, streak_7, logs_10.
    sourcePreset: {
      key: 'arbor-source',
      name: 'Arbor Source (First Juice)',
      bedStages: {
        greens: { key: 'sprout', label: 'Sprout' },
        roots: { key: 'seed', label: 'Seed' },
        citrus: { key: 'empty', label: 'Empty' },
        orchard: { key: 'empty', label: 'Empty' },
        berries: { key: 'seed', label: 'Seed' },
        tropical: { key: 'empty', label: 'Empty' },
        herbs: { key: 'sprout', label: 'Sprout' },
      },
      journeyStageKey: 'seed',
      arborCtx: {
        unlockedAchievementIds: ['first_juice'],
        bedStages: {
          greens: { key: 'sprout' },
          roots: { key: 'seed' },
          citrus: { key: 'empty' },
          orchard: { key: 'empty' },
          berries: { key: 'seed' },
          tropical: { key: 'empty' },
          herbs: { key: 'sprout' },
        },
        rainbowComplete: false,
      },
    },
    advancements: {
      isFirstOpen: false,
      bedAdvancements: [],
      journeyAdvancement: null,
      newMilestoneIds: ['streak_3', 'streak_7', 'logs_10'],
      rainbowComplete: false,
    },
  },
  {
    key: 'arborSingleNew',
    name: 'Arbor +1',
    // Self-contained source: only 'first_juice' unlocked.
    // newMilestoneIds will add streak_3 (single new milestone).
    sourcePreset: {
      key: 'arbor-single-source',
      name: 'Arbor +1 Source (First Juice)',
      bedStages: {
        greens: { key: 'sprout', label: 'Sprout' },
        roots: { key: 'seed', label: 'Seed' },
        citrus: { key: 'empty', label: 'Empty' },
        orchard: { key: 'empty', label: 'Empty' },
        berries: { key: 'seed', label: 'Seed' },
        tropical: { key: 'empty', label: 'Empty' },
        herbs: { key: 'sprout', label: 'Sprout' },
      },
      journeyStageKey: 'seed',
      arborCtx: {
        unlockedAchievementIds: ['first_juice'],
        bedStages: {
          greens: { key: 'sprout' },
          roots: { key: 'seed' },
          citrus: { key: 'empty' },
          orchard: { key: 'empty' },
          berries: { key: 'seed' },
          tropical: { key: 'empty' },
          herbs: { key: 'sprout' },
        },
        rainbowComplete: false,
      },
    },
    advancements: {
      isFirstOpen: false,
      bedAdvancements: [],
      journeyAdvancement: null,
      newMilestoneIds: ['streak_3'],
      rainbowComplete: false,
    },
  },
  {
    key: 'coalescedMulti',
    name: 'Coalesced Multi',
    // Self-contained source: journey='growing', beds at pre-flourishing stages.
    // advancement will move beds to 'flourishing' and journey to 'thriving'.
    sourcePreset: {
      key: 'coalesced-source',
      name: 'Coalesced Source (Growing)',
      bedStages: {
        greens: { key: 'harvesting', label: 'Harvesting' },
        roots: { key: 'growing', label: 'Growing' },
        citrus: { key: 'sprout', label: 'Sprout' },
        orchard: { key: 'growing', label: 'Growing' },
        berries: { key: 'harvesting', label: 'Harvesting' },
        tropical: { key: 'seed', label: 'Seed' },
        herbs: { key: 'flourishing', label: 'Flourishing' },
      },
      journeyStageKey: 'growing',
      arborCtx: {
        unlockedAchievementIds: ['first_juice', 'streak_3', 'streak_7', 'logs_10'],
        bedStages: {
          greens: { key: 'harvesting' },
          roots: { key: 'growing' },
          citrus: { key: 'sprout' },
          orchard: { key: 'growing' },
          berries: { key: 'harvesting' },
          tropical: { key: 'seed' },
          herbs: { key: 'flourishing' },
        },
        rainbowComplete: false,
      },
    },
    advancements: {
      isFirstOpen: false,
      bedAdvancements: [
        { bedKey: 'greens', fromStage: 'harvesting', toStage: 'flourishing' },
        { bedKey: 'roots', fromStage: 'growing', toStage: 'flourishing' },
        { bedKey: 'orchard', fromStage: 'growing', toStage: 'flourishing' },
        { bedKey: 'berries', fromStage: 'harvesting', toStage: 'flourishing' },
      ],
      journeyAdvancement: { fromStage: 'growing', toStage: 'thriving' },
      newMilestoneIds: [],
      rainbowComplete: false,
    },
  },
  {
    key: 'rainbow',
    name: 'Rainbow',
    // Self-contained source: journey='thriving', citrus='harvesting', tropical='growing'.
    // advancement will move citrus/tropical to 'flourishing', journey to 'legend', rainbow=true.
    sourcePreset: {
      key: 'rainbow-source',
      name: 'Rainbow Source (Thriving)',
      bedStages: {
        greens: { key: 'flourishing', label: 'Flourishing' },
        roots: { key: 'flourishing', label: 'Flourishing' },
        citrus: { key: 'harvesting', label: 'Harvesting' },
        orchard: { key: 'flourishing', label: 'Flourishing' },
        berries: { key: 'flourishing', label: 'Flourishing' },
        tropical: { key: 'growing', label: 'Growing' },
        herbs: { key: 'flourishing', label: 'Flourishing' },
      },
      journeyStageKey: 'thriving',
      arborCtx: {
        unlockedAchievementIds: ['first_juice', 'streak_3', 'streak_7', 'logs_10'],
        bedStages: {
          greens: { key: 'flourishing' },
          roots: { key: 'flourishing' },
          citrus: { key: 'harvesting' },
          orchard: { key: 'flourishing' },
          berries: { key: 'flourishing' },
          tropical: { key: 'growing' },
          herbs: { key: 'flourishing' },
        },
        rainbowComplete: false,
      },
    },
    advancements: {
      isFirstOpen: false,
      bedAdvancements: [
        { bedKey: 'citrus', fromStage: 'harvesting', toStage: 'flourishing' },
        { bedKey: 'tropical', fromStage: 'growing', toStage: 'flourishing' },
      ],
      journeyAdvancement: { fromStage: 'thriving', toStage: 'legend' },
      newMilestoneIds: [],
      rainbowComplete: true,
    },
  },
]

// ── Motion V2 Calibration scenario (separate from TRANSITION_SCENARIOS) ──
// Uses motionVariant='v2-calibration' to route Greens through the
// V2 calibration bed instead of the production LivingGardenBed.
const V2_CALIBRATION_SCENARIO = {
  key: 'v2GreensGrowingToHarvesting',
  name: 'V2 CALIBRATION\nGreens: Growing→Harvest',
  sourcePreset: {
    key: 'v2-greens-source',
    name: 'V2 Greens Source (Growing)',
    bedStages: {
      greens: { key: 'growing', label: 'Growing' },
      roots: { key: 'seed', label: 'Seed' },
      citrus: { key: 'empty', label: 'Empty' },
      orchard: { key: 'empty', label: 'Empty' },
      berries: { key: 'seed', label: 'Seed' },
      tropical: { key: 'empty', label: 'Empty' },
      herbs: { key: 'sprout', label: 'Sprout' },
    },
    journeyStageKey: 'seed',
    arborCtx: {
      unlockedAchievementIds: ['first_juice'],
      bedStages: {
        greens: { key: 'growing' },
        roots: { key: 'seed' },
        citrus: { key: 'empty' },
        orchard: { key: 'empty' },
        berries: { key: 'seed' },
        tropical: { key: 'empty' },
        herbs: { key: 'sprout' },
      },
      rainbowComplete: false,
    },
  },
  advancements: {
    isFirstOpen: false,
    bedAdvancements: [{ bedKey: 'greens', fromStage: 'growing', toStage: 'harvesting' }],
    journeyAdvancement: null,
    newMilestoneIds: [],
    rainbowComplete: false,
  },
  motionVariant: 'v2-calibration',
}

// ── Motion V3 HERO Calibration scenario ──
// Uses motionVariant='v3-hero' to route Greens through the
// V3 HERO calibration bed instead of the production LivingGardenBed.
// Visually distinct from V2 for physical comparison.
const V3_HERO_SCENARIO = {
  key: 'v3HeroGreensGrowingToHarvesting',
  name: 'V3 HERO\nGreens: Growing→Harvest',
  sourcePreset: {
    key: 'v3-greens-source',
    name: 'V3 Greens Source (Growing)',
    bedStages: {
      greens: { key: 'growing', label: 'Growing' },
      roots: { key: 'seed', label: 'Seed' },
      citrus: { key: 'empty', label: 'Empty' },
      orchard: { key: 'empty', label: 'Empty' },
      berries: { key: 'seed', label: 'Seed' },
      tropical: { key: 'empty', label: 'Empty' },
      herbs: { key: 'sprout', label: 'Sprout' },
    },
    journeyStageKey: 'seed',
    arborCtx: {
      unlockedAchievementIds: ['first_juice'],
      bedStages: {
        greens: { key: 'growing' },
        roots: { key: 'seed' },
        citrus: { key: 'empty' },
        orchard: { key: 'empty' },
        berries: { key: 'seed' },
        tropical: { key: 'empty' },
        herbs: { key: 'sprout' },
      },
      rainbowComplete: false,
    },
  },
  advancements: {
    isFirstOpen: false,
    bedAdvancements: [{ bedKey: 'greens', fromStage: 'growing', toStage: 'harvesting' }],
    journeyAdvancement: null,
    newMilestoneIds: [],
    rainbowComplete: false,
  },
  motionVariant: 'v3-hero',
}

// ── Motion V4 HERO FOCUS Calibration scenario ──
// Uses motionVariant='v4-hero-focus' to route Greens through the
// V4 HERO FOCUS calibration bed with anchored magnification.
// Visually distinct from V2 (amber) and V3 (blue) for physical comparison.
const V4_HERO_FOCUS_SCENARIO = {
  key: 'v4HeroFocusGreensGrowingToHarvesting',
  name: 'V4 HERO FOCUS\nGreens: Growing→Harvest',
  sourcePreset: {
    key: 'v4-greens-source',
    name: 'V4 Greens Source (Growing)',
    bedStages: {
      greens: { key: 'growing', label: 'Growing' },
      roots: { key: 'seed', label: 'Seed' },
      citrus: { key: 'empty', label: 'Empty' },
      orchard: { key: 'empty', label: 'Empty' },
      berries: { key: 'seed', label: 'Seed' },
      tropical: { key: 'empty', label: 'Empty' },
      herbs: { key: 'sprout', label: 'Sprout' },
    },
    journeyStageKey: 'seed',
    arborCtx: {
      unlockedAchievementIds: ['first_juice'],
      bedStages: {
        greens: { key: 'growing' },
        roots: { key: 'seed' },
        citrus: { key: 'empty' },
        orchard: { key: 'empty' },
        berries: { key: 'seed' },
        tropical: { key: 'empty' },
        herbs: { key: 'sprout' },
      },
      rainbowComplete: false,
    },
  },
  advancements: {
    isFirstOpen: false,
    bedAdvancements: [{ bedKey: 'greens', fromStage: 'growing', toStage: 'harvesting' }],
    journeyAdvancement: null,
    newMilestoneIds: [],
    rainbowComplete: false,
  },
  motionVariant: 'v4-hero-focus',
}

// ── Motion V5 MERGE PROOF Calibration scenario ──
// Uses motionVariant='v5-merge-proof' to route Greens through the
// V5 Phase A merge proof: large hero → convergence → crossfade → canonical.
// Source AND target are both canonical Harvesting (no progression animation).
const V5_MERGE_PROOF_SCENARIO = {
  key: 'v5MergeProofGreensHarvesting',
  name: 'V5 MERGE PROOF\nGreens: Hero→Canonical',
  sourcePreset: {
    key: 'v5-greens-source',
    name: 'V5 Greens Source (Harvesting)',
    bedStages: {
      greens: { key: 'harvesting', label: 'Harvesting' },
      roots: { key: 'seed', label: 'Seed' },
      citrus: { key: 'empty', label: 'Empty' },
      orchard: { key: 'empty', label: 'Empty' },
      berries: { key: 'seed', label: 'Seed' },
      tropical: { key: 'empty', label: 'Empty' },
      herbs: { key: 'sprout', label: 'Sprout' },
    },
    journeyStageKey: 'seed',
    arborCtx: {
      unlockedAchievementIds: ['first_juice'],
      bedStages: {
        greens: { key: 'harvesting' },
        roots: { key: 'seed' },
        citrus: { key: 'empty' },
        orchard: { key: 'empty' },
        berries: { key: 'seed' },
        tropical: { key: 'empty' },
        herbs: { key: 'sprout' },
      },
      rainbowComplete: false,
    },
  },
  // V5 Phase A: advancement triggers the merge proof sequence.
  // fromStage and toStage are both 'harvesting' — no progression change.
  // The advancement object is just a trigger signal.
  advancements: {
    isFirstOpen: false,
    bedAdvancements: [{ bedKey: 'greens', fromStage: 'harvesting', toStage: 'harvesting' }],
    journeyAdvancement: null,
    newMilestoneIds: [],
    rainbowComplete: false,
  },
  motionVariant: 'v5-merge-proof',
}

// ── Combined scenario list for Replay lookup ──────────────────
// handleReplay must find the active scenario whether it's a standard
// transition scenario or a calibration scenario (V2/V3/V4/V5).
const ALL_SCENARIOS = [
  ...TRANSITION_SCENARIOS,
  V2_CALIBRATION_SCENARIO,
  V3_HERO_SCENARIO,
  V4_HERO_FOCUS_SCENARIO,
  V5_MERGE_PROOF_SCENARIO,
]

// ── No-op handlers — preview does not navigate into real Garden state ──
const noop = () => {}

// ── Local error boundary (QA-only — catches scene render errors) ──
class PreviewErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: String(error && error.message ? error.message : error) }
  }

  componentDidCatch(error, errorInfo) {
    // In QA build, log to console for logcat capture
    console.error('[GardenPreview] Scene render error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Preview Scene Error</Text>
          <Text style={styles.errorText}>{this.state.errorMessage}</Text>
          <TouchableOpacity
            style={styles.errorResetBtn}
            onPress={() => this.setState({ hasError: false, errorMessage: '' })}
          >
            <Text style={styles.errorResetText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

// ── Fitted scene wrapper ──────────────────────────────────────
// Measures available area via onLayout, then scales the fixed
// 390×720 scene to fit entirely without cropping.
// scale = min(availableWidth / 390, availableHeight / 720)
// The scene is rendered at its native 390×720 size inside a
// container of that exact size, then the container is scaled
// via transform. This preserves aspect ratio and shows all 7 beds.
//
// KEY: ONE LivingGardenScene instance stays mounted. Transitions
// happen by changing synthetic props (preset + advancements),
// exactly as production transitions occur. No renderKey remount.
const FittedScene = React.memo(function FittedScene({
  preset,
  availableWidth,
  availableHeight,
  isReduced,
  advancements,
  sceneInstanceKey,
  onArborDebugValues,
  onRainbowMotionDebug,
  motionVariant,
  onV2Debug,
  onV3Debug,
  onV4Debug,
  onV5Debug,
  v5HeroScalePreset,
  v5ReplayToken,
  spotlightActive,
  spotlightBedKey,
  spotlightTargetStage,
  rainbowProbeActive,
}) {
  const scale = Math.min(availableWidth / SCENE_WIDTH, availableHeight / SCENE_HEIGHT)
  const scaledW = SCENE_WIDTH * scale
  const scaledH = SCENE_HEIGHT * scale

  return (
    <View
      style={{
        width: scaledW,
        height: scaledH,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: SCENE_WIDTH,
          height: SCENE_HEIGHT,
          transform: [{ scale }],
        }}
      >
        <PreviewErrorBoundary>
          <LivingGardenScene
            bedStages={preset.bedStages}
            journeyStageKey={preset.journeyStageKey}
            arborCtx={preset.arborCtx}
            isReduced={isReduced}
            onBedPress={noop}
            onTreePress={noop}
            onArborPress={noop}
            sceneId={`preview-${sceneInstanceKey}`}
            advancements={advancements}
            onArborDebugValues={onArborDebugValues}
            onRainbowMotionDebug={onRainbowMotionDebug}
            motionVariant={motionVariant}
            onV2Debug={onV2Debug}
            onV3Debug={onV3Debug}
            onV4Debug={onV4Debug}
            onV5Debug={onV5Debug}
            v5HeroScalePreset={v5HeroScalePreset}
            v5ReplayToken={v5ReplayToken}
            spotlightActive={spotlightActive}
            spotlightBedKey={spotlightBedKey}
            spotlightTargetStage={spotlightTargetStage}
            rainbowProbeActive={rainbowProbeActive}
          />
        </PreviewErrorBoundary>
      </View>
    </View>
  )
})

// ── Preview screen component ───────────────────────────────────
export default function GardenPreviewScreen({ navigation }) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [sceneArea, setSceneArea] = useState({ width: 0, height: 0 })
  const [isReduced, setIsReduced] = useState(false)
  const [advancements, setAdvancements] = useState(null)
  const [sceneInstanceKey, setSceneInstanceKey] = useState(0)
  const [customPreset, setCustomPreset] = useState(null) // overrides PRESETS[selectedIdx] during transitions
  const [eventId, setEventId] = useState(0) // incrementing ID for each transition trigger
  const [activeScenario, setActiveScenario] = useState(null) // currently running scenario key
  const [arborDebugValues, setArborDebugValues] = useState(null) // QA-only diagnostic
  const [rainbowMotionDebug, setRainbowMotionDebug] = useState(null) // QA-only diagnostic
  const [rainbowProbeActive, setRainbowProbeActive] = useState(false) // QA-only static visibility probe
  const [v2DebugValues, setV2DebugValues] = useState(null) // Motion V2 QA diagnostic
  const [v3DebugValues, setV3DebugValues] = useState(null) // Motion V3 HERO QA diagnostic
  const [v4DebugValues, setV4DebugValues] = useState(null) // Motion V4 HERO FOCUS QA diagnostic
  const [v5DebugValues, setV5DebugValues] = useState(null) // Motion V5 MERGE PROOF QA diagnostic
  const [v5HeroScalePreset, setV5HeroScalePreset] = useState('B1A') // V5 hero scale: B1A rich geometry
  const [v5ReplayToken, setV5ReplayToken] = useState(0) // V5 explicit replay trigger token
  const [motionVariant, setMotionVariant] = useState(null) // 'v2-calibration', 'v3-hero', 'v4-hero-focus', 'v5-merge-proof', or null
  // V6 Spotlight state (dev-preview prototype)
  const [spotlightActive, setSpotlightActive] = useState(false)
  const [spotlightBedKey, setSpotlightBedKey] = useState('greens')
  const [spotlightReplayToken, setSpotlightReplayToken] = useState(0)
  const replayTimerRef = useRef(null)
  const transitionTimerRef = useRef(null)
  // customPreset overrides the selected preset when set.
  // When null, the selected preset is used.
  // Fallback to PRESETS[0] if selectedIdx is invalid (e.g. -1 during scenario).
  const preset = customPreset || PRESETS[selectedIdx] || PRESETS[0]

  const handleBack = useCallback(() => {
    if (navigation) navigation.goBack()
  }, [navigation])

  const handleSelectPreset = useCallback((idx) => {
    setSelectedIdx(idx)
    setAdvancements(null)
    setCustomPreset(null)
    setActiveScenario(null)
  }, [])

  const handleSceneLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout
    setSceneArea({ width, height })
  }, [])

  const handleToggleReduced = useCallback(() => {
    setIsReduced((r) => !r)
  }, [])

  // ── Trigger a transition scenario (two-step) ──────────────
  // Step 1: Show the SOURCE preset so the user sees the starting state.
  //         Each scenario owns its source state (sourcePreset or presetIdx).
  //         The scene is remounted to clear any previous scenario's state.
  // Step 2: After SOURCE_DISPLAY_MS, switch to the TARGET preset
  //         (computed by applying the advancement's toStage) AND
  //         pass the advancement to the Scene's motion hook.
  //
  // This mirrors production: the Scene renders the DESTINATION state,
  // and the motion hook animates from a compressed/transparent version
  // toward canonical.
  const handleTriggerScenario = useCallback((scenario) => {
    // Clear any pending transition
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }

    // Resolve source preset: self-contained sourcePreset takes priority
    const sourcePreset = scenario.sourcePreset || PRESETS[scenario.presetIdx]

    // Set motion variant for V2 calibration scenarios
    setMotionVariant(scenario.motionVariant || null)
    setV2DebugValues(null)
    setV3DebugValues(null)
    setV4DebugValues(null)
    setV5DebugValues(null)
    setRainbowMotionDebug(null)

    // Step 1: Show source preset, clear advancements and custom preset.
    // Remount scene to ensure no previous scenario contaminates this one.
    setAdvancements(null)
    setCustomPreset(null)
    setActiveScenario(scenario.key)
    setEventId((id) => id + 1)
    setSceneInstanceKey((k) => k + 1)
    // Use customPreset to display the source state (not selectedIdx)
    // so self-contained sourcePresets work without a PRESETS entry.
    setCustomPreset({ ...sourcePreset, key: `${sourcePreset.key}-source-display` })
    setSelectedIdx(-1)

    // Step 2: After showing source, switch to target + pass advancement
    transitionTimerRef.current = setTimeout(() => {
      const targetPreset = computeTargetPreset(sourcePreset, scenario.advancements)
      setCustomPreset(targetPreset)
      setAdvancements({ ...scenario.advancements, _ts: Date.now() })
      transitionTimerRef.current = null
    }, SOURCE_DISPLAY_MS)
  }, [])

  // ── Replay: re-trigger the same scenario ──────────────────
  // Searches ALL_SCENARIOS (standard + V2/V3/V4/V5 calibration) so that
  // pressing Replay while a calibration scenario is active re-triggers
  // THAT scenario, not the first standard one.
  const handleReplay = useCallback(() => {
    if (activeScenario) {
      const scenario = ALL_SCENARIOS.find((s) => s.key === activeScenario)
      if (scenario) {
        // Increment V5 replay token if this is a V5 scenario
        if (scenario.motionVariant === 'v5-merge-proof') {
          setV5ReplayToken((t) => t + 1)
        }
        handleTriggerScenario(scenario)
        return
      }
    }
    // No active scenario — trigger the first
    handleTriggerScenario(TRANSITION_SCENARIOS[0])
  }, [activeScenario, handleTriggerScenario])

  // ── Reset: clear advancements, custom preset, and remount ──
  const handleReset = useCallback(() => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }
    setAdvancements(null)
    setCustomPreset(null)
    setActiveScenario(null)
    setSelectedIdx(0)
    setMotionVariant(null)
    setSpotlightActive(false)
    setV2DebugValues(null)
    setV3DebugValues(null)
    setV4DebugValues(null)
    setV5DebugValues(null)
    // Remount the scene to clear all motion state
    setSceneInstanceKey((k) => k + 1)
  }, [])

  // ── Cleanup timers on unmount ─────────────────────────────
  useEffect(() => {
    return () => {
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current)
      }
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
      }
    }
  }, [])

  // ── V6 Spotlight: trigger Growing → Harvesting ────────────
  // Dev-preview prototype only. No persistence, no advancement events.
  // bedKey: 'greens' or 'roots'
  // 1. Set preset to source (v6-growing or v6-roots-growing)
  // 2. Activate spotlight (hides in-grid bed, shows overlay)
  // 3. In-grid bed pre-warms to Harvesting (target)
  // 4. Spotlight overlay runs timeline
  // 5. On complete: set preset to target, deactivate spotlight
  const handleSpotlightTrigger = useCallback((bedKey) => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }
    setAdvancements(null)
    setCustomPreset(null)
    setActiveScenario(null)
    setMotionVariant(null)
    setSpotlightBedKey(bedKey)
    // Find source preset index by key
    const sourceIdx = PRESETS.findIndex((p) => p.key === `v6-${bedKey}-growing`)
    setSelectedIdx(sourceIdx >= 0 ? sourceIdx : 0)
    setSpotlightActive(true)
    setSpotlightReplayToken((t) => t + 1)
  }, [])

  const handleSpotlightComplete = useCallback(() => {
    const targetIdx = PRESETS.findIndex((p) => p.key === `v6-${spotlightBedKey}-harvest`)
    setSelectedIdx(targetIdx >= 0 ? targetIdx : 0)
    setSpotlightActive(false)
  }, [spotlightBedKey])

  const handleSpotlightReplay = useCallback(() => {
    const sourceIdx = PRESETS.findIndex((p) => p.key === `v6-${spotlightBedKey}-growing`)
    setSelectedIdx(sourceIdx >= 0 ? sourceIdx : 0)
    setSpotlightActive(true)
    setSpotlightReplayToken((t) => t + 1)
  }, [spotlightBedKey])

  // ── Diagnostic status (QA-only) ───────────────────────────
  const diagnosticLine = useMemo(() => {
    const bedAdv = advancements?.bedAdvancements?.length || 0
    const journeyAdv = advancements?.journeyAdvancement ? 'yes' : 'no'
    const arborNew = advancements?.newMilestoneIds?.length || 0
    const rainbow = advancements?.rainbowComplete ? 'yes' : 'no'
    return `beds=${bedAdv} · journey=${journeyAdv} · arbor=${arborNew} · rainbow=${rainbow}`
  }, [advancements])

  // ── V5 scene geometry (for foreground overlay coordinate mapping) ──
  // Computes the FittedScene's scale and offset so the V5HeroOverlay
  // can map SVG coordinates to screen coordinates.
  const v5SceneGeometry = useMemo(() => {
    if (sceneArea.width <= 0 || sceneArea.height <= 0) return null
    const scale = Math.min(
      sceneArea.width / V5_GARDEN_VIEWPORT_W,
      sceneArea.height / V5_GARDEN_VIEWPORT_H,
    )
    const scaledW = V5_GARDEN_VIEWPORT_W * scale
    const scaledH = V5_GARDEN_VIEWPORT_H * scale
    const offsetX = (sceneArea.width - scaledW) / 2
    const offsetY = (sceneArea.height - scaledH) / 2
    return { scale, offsetX, offsetY, width: sceneArea.width, height: sceneArea.height }
  }, [sceneArea])

  // ── V5 readability diagnostic (B0.2: botanical readability metrics) ──
  const v5OccupancyDiag = useMemo(() => {
    if (!v5DebugValues) return null
    const localScale = v5DebugValues.localRosetteScale || v5DebugValues.heroScale || 1.0
    const rootSpread = v5DebugValues.rootSpreadScale || 1.0
    const cx = V5_GREENS_CX, cy = V5_GREENS_CY

    // Hero bbox in SVG coordinates
    const heroBBox = v5ComputeHeroBBoxSvg(localScale, rootSpread, cx, cy)

    // Visible Garden rect = [0, 390] × [0, 720] (FittedScene fits entirely)
    const visibleIntersection = v5ComputeVisibleIntersection(heroBBox, V5_GARDEN_VIEWPORT_W, V5_GARDEN_VIEWPORT_H)
    const visibleOccupancy = visibleIntersection.area / (V5_GARDEN_VIEWPORT_W * V5_GARDEN_VIEWPORT_H)

    // Root spread metrics
    const rootSpreadCanonical = V5_CANONICAL_ROOT_SPREAD
    const rootSpreadHero = V5_CANONICAL_ROOT_SPREAD * rootSpread
    const rootSpreadRatio = rootSpread

    // Overflow (how much hero extends beyond visible Garden)
    const leftOverflow = Math.max(0, -heroBBox.left)
    const rightOverflow = Math.max(0, heroBBox.right - V5_GARDEN_VIEWPORT_W)
    const topOverflow = Math.max(0, -heroBBox.top)
    const bottomOverflow = Math.max(0, heroBBox.bottom - V5_GARDEN_VIEWPORT_H)

    // Merge alignment: at scale 1.0, hero should match canonical exactly
    const mergeAligned = localScale === 1.0 && rootSpread === 1.0 ? 'YES' : 'NO'

    // B0.2: Botanical readability metrics
    // Largest leaf apparent dimensions (in SVG units, scaled by localRosetteScale)
    const largestLeafW = V5_LARGEST_LEAF_WIDTH * localScale
    const largestLeafH = V5_LARGEST_LEAF_LENGTH * localScale

    // Convert to approximate screen dp using FittedScene scale
    // (sceneArea scale = min(sceneW/390, sceneH/720))
    const sceneScale = v5SceneGeometry ? v5SceneGeometry.scale : 1.0
    const largestLeafWdp = largestLeafW * sceneScale
    const largestLeafHdp = largestLeafH * sceneScale

    // Expected unfurl tip travel: a leaf rotating/extending could travel
    // roughly its own length. Report the potential tip path.
    const unfurlTipTravelDp = largestLeafHdp

    // Garden visible behind Hero (hero doesn't cover entire Garden)
    const gardenVisibleBehind = heroBBox.right - heroBBox.left < V5_GARDEN_VIEWPORT_W ? 'YES' : 'NO'

    const targetScale = V5_LOCAL_ROSETTE_SCALE_PRESETS[v5HeroScalePreset] || V5_LOCAL_ROSETTE_SCALE_PRESETS.MEDIUM

    return {
      localScale,
      rootSpread,
      visibleOccupancy,
      targetScale,
      heroBBoxW: heroBBox.w,
      heroBBoxH: heroBBox.h,
      visibleIntW: visibleIntersection.w,
      visibleIntH: visibleIntersection.h,
      rootSpreadCanonical,
      rootSpreadHero,
      rootSpreadRatio,
      leftOverflow,
      rightOverflow,
      topOverflow,
      bottomOverflow,
      overlayMode: 'FOREGROUND_OVERLAY',
      clipped: leftOverflow > 0 || rightOverflow > 0 || topOverflow > 0 || bottomOverflow > 0 ? 'YES' : 'NO',
      mergeAligned,
      largestLeafW,
      largestLeafH,
      largestLeafWdp,
      largestLeafHdp,
      unfurlTipTravelDp,
      gardenVisibleBehind,
    }
  }, [v5DebugValues, v5HeroScalePreset, v5SceneGeometry])

  const scenarioDiagnostic = useMemo(() => {
    const scenarioName = activeScenario || 'none'
    const motionMode = isReduced ? 'reduced' : 'normal'
    const fromStage =
      advancements?.bedAdvancements?.[0]?.fromStage ||
      advancements?.journeyAdvancement?.fromStage ||
      '-'
    const toStage =
      advancements?.bedAdvancements?.[0]?.toStage ||
      advancements?.journeyAdvancement?.toStage ||
      '-'
    const phase = advancements ? 'MOTION' : 'IDLE'
    // Show rendered journey for QA source/target verification
    const renderedJourney = preset?.journeyStageKey || '-'
    const sourceJourney = activeScenario
      ? (TRANSITION_SCENARIOS.find((s) => s.key === activeScenario)?.sourcePreset
          ?.journeyStageKey ||
        TRANSITION_SCENARIOS.find((s) => s.key === activeScenario)?.advancements
          ?.journeyAdvancement?.fromStage ||
        '-')
      : '-'
    const targetJourney = activeScenario
      ? (TRANSITION_SCENARIOS.find((s) => s.key === activeScenario)?.advancements
          ?.journeyAdvancement?.toStage ||
        TRANSITION_SCENARIOS.find((s) => s.key === activeScenario)?.sourcePreset
          ?.journeyStageKey ||
        '-')
      : '-'
    return `scenario=${scenarioName} | motion=${motionMode} | event=${eventId} | sourceJourney=${sourceJourney} | targetJourney=${targetJourney} | renderedJourney=${renderedJourney} | ${fromStage}→${toStage} | ${phase}`
  }, [activeScenario, isReduced, eventId, advancements, preset])

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Done</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Living Garden Preview</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Motion mode toggle */}
      <View style={styles.motionRow}>
        <TouchableOpacity
          onPress={handleToggleReduced}
          style={[styles.motionBtn, !isReduced && styles.motionBtnActive]}
        >
          <Text style={[styles.motionText, !isReduced && styles.motionTextActive]}>
            Normal Motion
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleToggleReduced}
          style={[styles.motionBtn, isReduced && styles.motionBtnActiveReduced]}
        >
          <Text style={[styles.motionText, isReduced && styles.motionTextActive]}>
            Reduced Motion
          </Text>
        </TouchableOpacity>
      </View>

      {/* Preset selector */}
      <View style={styles.presetRow}>
        {PRESETS.map((p, idx) => (
          <TouchableOpacity
            key={p.key}
            onPress={() => handleSelectPreset(idx)}
            style={[styles.presetBtn, idx === selectedIdx && styles.presetBtnActive]}
          >
            <Text style={[styles.presetText, idx === selectedIdx && styles.presetTextActive]}>
              {(() => {
                const p = PRESETS[idx]
                if (!p) return ''
                if (idx <= 3) return ['Early', '1 Month', 'Established', 'Legend'][idx]
                return p.name.replace('V6 ', '')
              })()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── NON-BED PROGRESS MOTION ── */}
      <Text style={styles.sectionLabel}>NON-BED PROGRESS MOTION</Text>
      <View style={styles.controlRow}>
        <TouchableOpacity
          onPress={() => {
            const s = TRANSITION_SCENARIOS.find((sc) => sc.key === 'journeyAdvance')
            if (s) handleTriggerScenario(s)
          }}
          style={[styles.replayBtn, { backgroundColor: '#3B6E4A' }]}
        >
          <Text style={styles.replayText}>JOURNEY TREE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            const s = TRANSITION_SCENARIOS.find((sc) => sc.key === 'arborSingleNew')
            if (s) handleTriggerScenario(s)
          }}
          style={[styles.replayBtn, { backgroundColor: '#7A5B44' }]}
        >
          <Text style={styles.replayText}>ARBOR +1</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.controlRow}>
        <TouchableOpacity
          onPress={() => {
            const s = TRANSITION_SCENARIOS.find((sc) => sc.key === 'arborNew')
            if (s) handleTriggerScenario(s)
          }}
          style={[styles.replayBtn, { backgroundColor: '#7A5B44' }]}
        >
          <Text style={styles.replayText}>ARBOR +3</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            const s = TRANSITION_SCENARIOS.find((sc) => sc.key === 'rainbow')
            if (s) handleTriggerScenario(s)
          }}
          style={[styles.replayBtn, { backgroundColor: '#9B7EC8' }]}
        >
          <Text style={styles.replayText}>RAINBOW</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setRainbowProbeActive((v) => !v)}
          style={[
            styles.replayBtn,
            { backgroundColor: rainbowProbeActive ? '#E8B84B' : '#B8A050' },
          ]}
        >
          <Text style={styles.replayText}>
            RAINBOW PROBE {rainbowProbeActive ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Transition scenario triggers */}
      <ScrollView style={styles.scenarioScroll} horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.scenarioRow}>
          {TRANSITION_SCENARIOS.map((scenario) => (
            <TouchableOpacity
              key={scenario.key}
              onPress={() => handleTriggerScenario(scenario)}
              style={styles.scenarioBtn}
            >
              <Text style={styles.scenarioText}>{scenario.name}</Text>
            </TouchableOpacity>
          ))}
          {/* Motion V2 Calibration button — visually distinct */}
          <TouchableOpacity
            onPress={() => handleTriggerScenario(V2_CALIBRATION_SCENARIO)}
            style={styles.v2ScenarioBtn}
          >
            <Text style={styles.v2ScenarioText}>{V2_CALIBRATION_SCENARIO.name}</Text>
          </TouchableOpacity>
          {/* Motion V3 HERO Calibration button — visually distinct from V2 */}
          <TouchableOpacity
            onPress={() => handleTriggerScenario(V3_HERO_SCENARIO)}
            style={styles.v3ScenarioBtn}
          >
            <Text style={styles.v3ScenarioText}>{V3_HERO_SCENARIO.name}</Text>
          </TouchableOpacity>
          {/* Motion V4 HERO FOCUS Calibration button — visually distinct from V2/V3 */}
          <TouchableOpacity
            onPress={() => handleTriggerScenario(V4_HERO_FOCUS_SCENARIO)}
            style={styles.v4ScenarioBtn}
          >
            <Text style={styles.v4ScenarioText}>{V4_HERO_FOCUS_SCENARIO.name}</Text>
          </TouchableOpacity>
          {/* Motion V5 MERGE PROOF Calibration button — visually distinct (green/teal) */}
          <TouchableOpacity
            onPress={() => handleTriggerScenario(V5_MERGE_PROOF_SCENARIO)}
            style={styles.v5ScenarioBtn}
          >
            <Text style={styles.v5ScenarioText}>{V5_MERGE_PROOF_SCENARIO.name}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* V5 Hero Scale — B1A single rich configuration */}
      {motionVariant === 'v5-merge-proof' && (
        <View style={styles.v5ScaleSelectorRow}>
          <Text style={styles.v5ScaleSelectorLabel}>V5 CLOSED — V6 GATE 1.1 CANONICAL DELTA — USE V6 Grow / V6 Harvest PRESETS</Text>
        </View>
      )}

      {/* Replay / Reset controls */}
      <View style={styles.controlRow}>
        <TouchableOpacity onPress={handleReplay} style={styles.replayBtn}>
          <Text style={styles.replayText}>↻ Replay</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
          <Text style={styles.resetText}>⟲ Reset</Text>
        </TouchableOpacity>
      </View>

      {/* V6 Spotlight control — dev-preview prototype */}
      <View style={styles.controlRow}>
        <TouchableOpacity
          onPress={() => handleSpotlightTrigger('greens')}
          style={[styles.replayBtn, { backgroundColor: '#2F7D4F' }]}
        >
          <Text style={styles.replayText}>V6 GREENS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleSpotlightTrigger('roots')}
          style={[styles.replayBtn, { backgroundColor: '#8B5E3C' }]}
        >
          <Text style={styles.replayText}>V6 ROOTS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleSpotlightTrigger('citrus')}
          style={[styles.replayBtn, { backgroundColor: '#D4943B' }]}
        >
          <Text style={styles.replayText}>V6 CITRUS</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.controlRow}>
        <TouchableOpacity
          onPress={() => handleSpotlightTrigger('orchard')}
          style={[styles.replayBtn, { backgroundColor: '#A85C3A' }]}
        >
          <Text style={styles.replayText}>V6 ORCHARD</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleSpotlightTrigger('tropical')}
          style={[styles.replayBtn, { backgroundColor: '#C9A227' }]}
        >
          <Text style={styles.replayText}>V6 TROPICAL</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleSpotlightTrigger('berries')}
          style={[styles.replayBtn, { backgroundColor: '#B83A5A' }]}
        >
          <Text style={styles.replayText}>V6 BERRIES</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.controlRow}>
        <TouchableOpacity
          onPress={() => handleSpotlightTrigger('herbs')}
          style={[styles.replayBtn, { backgroundColor: '#5A8C5A' }]}
        >
          <Text style={styles.replayText}>V6 HERBS</Text>
        </TouchableOpacity>
        {spotlightActive && (
          <TouchableOpacity
            onPress={handleSpotlightReplay}
            style={[styles.resetBtn, { backgroundColor: '#4A6B8A' }]}
          >
            <Text style={styles.resetText}>↻ Replay Spotlight</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Scene — measured and fitted to show entire 390×720 */}
      <View style={styles.sceneArea} onLayout={handleSceneLayout}>
        {sceneArea.width > 0 && sceneArea.height > 0 && (
          <FittedScene
            preset={preset}
            availableWidth={sceneArea.width}
            availableHeight={sceneArea.height}
            isReduced={isReduced}
            advancements={advancements}
            sceneInstanceKey={sceneInstanceKey}
            onArborDebugValues={setArborDebugValues}
            onRainbowMotionDebug={setRainbowMotionDebug}
            motionVariant={motionVariant}
            onV2Debug={setV2DebugValues}
            onV3Debug={setV3DebugValues}
            onV4Debug={setV4DebugValues}
            onV5Debug={setV5DebugValues}
            v5HeroScalePreset={v5HeroScalePreset}
            v5ReplayToken={v5ReplayToken}
            spotlightActive={spotlightActive}
            spotlightBedKey={spotlightBedKey}
            spotlightTargetStage={spotlightActive ? 'harvesting' : null}
            rainbowProbeActive={rainbowProbeActive}
          />
        )}
        {/* V5 Hero Foreground Overlay — renders hero OUTSIDE root SVG */}
        {/* so hero foliage can extend beyond the Garden viewport without clipping */}
        {motionVariant === 'v5-merge-proof' && v5SceneGeometry && v5DebugValues && (
          <V5HeroOverlay
            heroState={v5DebugValues}
            sceneGeometry={v5SceneGeometry}
            bedKey="greens"
          />
        )}
        {/* V6 Spotlight Foreground Overlay — renders canonical bed copy */}
        {/* above the scene to communicate "this bed advanced" */}
        {spotlightActive && sceneArea.width > 0 && sceneArea.height > 0 && (
          <LivingGardenSpotlight
            bedKey={spotlightBedKey}
            sourceStage="growing"
            targetStage="harvesting"
            isReduced={isReduced}
            replayToken={spotlightReplayToken}
            sceneId="v6-spotlight"
            onComplete={handleSpotlightComplete}
            availableWidth={sceneArea.width}
            availableHeight={sceneArea.height}
          />
        )}
      </View>

      {/* Preset label below scene */}
      <View style={styles.labelBar}>
        <Text style={styles.presetLabel}>{preset.name}</Text>
        <Text style={styles.presetDetail}>
          Journey: {preset.journeyStageKey === null ? 'null (unstarted)' : preset.journeyStageKey}
        </Text>
        <Text style={styles.presetDetail}>{diagnosticLine}</Text>
        <Text style={styles.scenarioDiagnostic}>{scenarioDiagnostic}</Text>
        <Text style={styles.motionModeLabel}>{isReduced ? 'REDUCED MOTION' : 'NORMAL MOTION'}</Text>
        {arborDebugValues && (
          <Text style={styles.presetDetail}>
            ARBOR phase={arborDebugValues.phase} sync=
            {arborDebugValues.syncReveal != null
              ? arborDebugValues.syncReveal.toFixed(2)
              : 'null'}
            {' '}state=
            {arborDebugValues.stateReveal != null
              ? arborDebugValues.stateReveal.toFixed(2)
              : 'null'}
            {' '}eff=
            {arborDebugValues.effectiveRevealProgress != null
              ? arborDebugValues.effectiveRevealProgress.toFixed(2)
              : 'null'}
            {' '}run={arborDebugValues.run} proc={arborDebugValues.processed}
            {arborDebugValues.effectiveNewIds &&
              arborDebugValues.effectiveNewIds.map((id) => {
                const v = arborDebugValues.perId[id]
                if (!v) return ''
                return ` ${id} p=${v.individualProgress.toFixed(2)} o=${v.ornamentOpacity.toFixed(2)} r=${v.render}`
              })}
          </Text>
        )}
        {rainbowMotionDebug && (
          <Text style={styles.presetDetail}>
            RAINBOW MOTION seen={rainbowMotionDebug.eventSeen || 0} run=
            {rainbowMotionDebug.runCalled || 0} delay=
            {rainbowMotionDebug.delay || 0} dur=
            {rainbowMotionDebug.durationArg != null ? rainbowMotionDebug.durationArg : '?'}
            {' '}started={rainbowMotionDebug.started || 0} completed=
            {rainbowMotionDebug.completed || 0} finished=
            {rainbowMotionDebug.finished || 0} cancelled=
            {rainbowMotionDebug.cancelled || 0} startV=
            {rainbowMotionDebug.startValue != null ? rainbowMotionDebug.startValue.toFixed(2) : '?'}
            {' '}maxBloom=
            {rainbowMotionDebug.maxBloom != null ? rainbowMotionDebug.maxBloom.toFixed(3) : '?'}
            {' '}elapsed={rainbowMotionDebug.elapsed || 0}ms
          </Text>
        )}
        {v2DebugValues && (
          <Text style={styles.presetDetail}>
            V2 GREENS act={v2DebugValues.act} {v2DebugValues.actName} progress=
            {v2DebugValues.progress.toFixed(2)} soil=
            {v2DebugValues.soilScale.toFixed(3)} emerge=
            {v2DebugValues.emergence.toFixed(2)} unfurl=
            {v2DebugValues.unfurl.toFixed(2)} height=
            {v2DebugValues.heightGrowth.toFixed(2)} vital=
            {v2DebugValues.vitality.toFixed(2)}
          </Text>
        )}
        {v3DebugValues && (
          <Text style={styles.presetDetail}>
            V3 HERO phase={v3DebugValues.phase} {v3DebugValues.phaseName} progress=
            {v3DebugValues.progress.toFixed(2)} soil=
            {v3DebugValues.soilScale.toFixed(3)} hero=
            {v3DebugValues.heroGrowth.toFixed(2)} unfurl=
            {v3DebugValues.unfurl.toFixed(2)} vital=
            {v3DebugValues.vitality.toFixed(2)} lift=
            {v3DebugValues.existingLift.toFixed(1)} illum=
            {v3DebugValues.sceneIllumination.toFixed(3)}
          </Text>
        )}
        {v4DebugValues && (
          <Text style={styles.presetDetail}>
            V4 HERO FOCUS phase={v4DebugValues.phase} {v4DebugValues.phaseName} progress=
            {v4DebugValues.progress.toFixed(2)} scale=
            {v4DebugValues.bedScale.toFixed(2)} hero=
            {v4DebugValues.heroGrowth.toFixed(2)} unfurl=
            {v4DebugValues.unfurl.toFixed(2)} vital=
            {v4DebugValues.vitality.toFixed(2)} localTravel=
            {v4DebugValues.localTravel} apparentTravel≈
            {v4DebugValues.apparentTravel.toFixed(1)}dp lift=
            {v4DebugValues.existingLift.toFixed(1)} focus=
            {v4DebugValues.sceneFocus.toFixed(3)} ground=
            {v4DebugValues.groundLight.toFixed(3)}
          </Text>
        )}
        {v5DebugValues && (
          <Text style={styles.presetDetail}>
            V5 HERO B1A preset={v5DebugValues.scalePreset} hScale=
            {v5DebugValues.localRosetteScale.toFixed(1)} vScale=
            {v5DebugValues.verticalScale.toFixed(1)} rootSpread=
            {v5DebugValues.rootSpreadScale.toFixed(3)} popOp=
            {v5DebugValues.populationOpacity !== undefined ? v5DebugValues.populationOpacity.toFixed(2) : '?'}
            phase={v5DebugValues.phaseName} frozen=
            {v5DebugValues.frozen ? 1 : 0} crossfade=
            {v5DebugValues.crossfade.toFixed(2)} heroOp=
            {v5DebugValues.heroOpacity.toFixed(3)} baseOp=
            {v5DebugValues.baseOpacity.toFixed(3)} gate=
            {v5DebugValues.gate}
            {'\n'}heroGeometry=RICH_V1 primaryRosettes=4 primaryBlades=
            {V5_PRIMARY_BLADE_COUNT || '?'} subClusters=3 subBlades=
            {V5_SUBORDINATE_BLADE_COUNT || '?'} totalBlades=
            {V5_TOTAL_HERO_BLADES || '?'} handoff=
            {V5_HANDOFF_BLADE_COUNT || '?'} temporary=
            {V5_TEMPORARY_BLADE_COUNT || '?'}
            {'\n'}heroBBoxW={v5OccupancyDiag ? v5OccupancyDiag.heroBBoxW.toFixed(1) : '?'}
            heroBBoxH={v5OccupancyDiag ? v5OccupancyDiag.heroBBoxH.toFixed(1) : '?'}
            soilOcclusion={v5DebugValues.populationOpacity > 0.01 ? 'ACTIVE' : 'INACTIVE'}
            handoffAlignment={v5DebugValues.frozen ? 'PASS' : 'PENDING'}
            mergeAligned={v5OccupancyDiag ? v5OccupancyDiag.mergeAligned : '?'}
            {v5DebugValues.presetResolutionError ? ' ⚠ V5 PRESET RESOLUTION ERROR' : ''}
          </Text>
        )}
      </View>
    </View>
  )
}

// ── Exports for testing ────────────────────────────────────────
export {
  PRESETS,
  TRANSITION_SCENARIOS,
  V2_CALIBRATION_SCENARIO,
  V3_HERO_SCENARIO,
  V4_HERO_FOCUS_SCENARIO,
  V5_MERGE_PROOF_SCENARIO,
  VALID_BED_STAGES,
  VALID_JOURNEY_KEYS,
  SCENE_WIDTH,
  SCENE_HEIGHT,
  SOURCE_DISPLAY_MS,
  computeTargetPreset,
}

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#04100A',
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(217, 164, 65, 0.2)',
  },
  backBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  backText: {
    color: '#D9A441',
    fontSize: 16,
  },
  title: {
    color: '#F0D9A0',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 60,
  },
  motionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  motionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 196, 176, 0.2)',
  },
  motionBtnActive: {
    borderColor: '#7BE3B0',
    backgroundColor: 'rgba(123, 227, 176, 0.12)',
  },
  motionBtnActiveReduced: {
    borderColor: '#F0891F',
    backgroundColor: 'rgba(240, 137, 31, 0.12)',
  },
  motionText: {
    color: '#A8C4B0',
    fontSize: 12,
  },
  motionTextActive: {
    fontWeight: '600',
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 196, 176, 0.2)',
  },
  presetBtnActive: {
    borderColor: '#D9A441',
    backgroundColor: 'rgba(217, 164, 65, 0.12)',
  },
  presetText: {
    color: '#A8C4B0',
    fontSize: 12,
  },
  presetTextActive: {
    color: '#F0D9A0',
    fontWeight: '600',
  },
  scenarioScroll: {
    maxHeight: 44,
  },
  scenarioRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 5,
  },
  scenarioBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(123, 227, 176, 0.3)',
    backgroundColor: 'rgba(123, 227, 176, 0.06)',
  },
  scenarioText: {
    color: '#7BE3B0',
    fontSize: 11,
  },
  v2ScenarioBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 200, 80, 0.6)',
    backgroundColor: 'rgba(255, 200, 80, 0.12)',
  },
  v2ScenarioText: {
    color: '#FFC850',
    fontSize: 10,
    fontWeight: '700',
  },
  v3ScenarioBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(94, 180, 255, 0.7)',
    backgroundColor: 'rgba(94, 180, 255, 0.15)',
  },
  v3ScenarioText: {
    color: '#5EB4FF',
    fontSize: 10,
    fontWeight: '800',
  },
  v4ScenarioBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 100, 200, 0.8)',
    backgroundColor: 'rgba(255, 100, 200, 0.15)',
  },
  v4ScenarioText: {
    color: '#FF64C8',
    fontSize: 10,
    fontWeight: '800',
  },
  v5ScenarioBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(100, 255, 180, 0.8)',
    backgroundColor: 'rgba(100, 255, 180, 0.15)',
  },
  v5ScenarioText: {
    color: '#64FFB4',
    fontSize: 10,
    fontWeight: '800',
  },
  v5ScaleSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 6,
  },
  v5ScaleSelectorLabel: {
    color: '#64FFB4',
    fontSize: 10,
    fontWeight: '700',
  },
  v5ScaleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(100, 255, 180, 0.4)',
    backgroundColor: 'rgba(100, 255, 180, 0.05)',
  },
  v5ScaleBtnActive: {
    borderColor: 'rgba(100, 255, 180, 0.9)',
    backgroundColor: 'rgba(100, 255, 180, 0.20)',
  },
  v5ScaleBtnText: {
    color: 'rgba(100, 255, 180, 0.6)',
    fontSize: 9,
    fontWeight: '600',
  },
  v5ScaleBtnTextActive: {
    color: '#64FFB4',
    fontWeight: '800',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  sectionLabel: {
    color: '#A0D8B0',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 2,
    letterSpacing: 1,
  },
  replayBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(123, 227, 176, 0.4)',
  },
  replayText: {
    color: '#7BE3B0',
    fontSize: 13,
  },
  resetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(240, 137, 31, 0.4)',
  },
  resetText: {
    color: '#F0891F',
    fontSize: 13,
  },
  sceneArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 150, // reserve fixed space for diagnostic overlay (absolute labelBar)
  },
  labelBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  presetLabel: {
    color: '#F0D9A0',
    fontSize: 14,
    fontWeight: '600',
  },
  presetDetail: {
    color: '#A8C4B0',
    fontSize: 11,
    marginTop: 2,
  },
  scenarioDiagnostic: {
    color: '#D9A441',
    fontSize: 10,
    marginTop: 4,
    fontFamily: 'monospace',
  },
  motionModeLabel: {
    color: '#A8C4B0',
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 1.2,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorTitle: {
    color: '#FF6B6B',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  errorText: {
    color: '#FFD54F',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorResetBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D9A441',
  },
  errorResetText: {
    color: '#D9A441',
    fontSize: 14,
  },
})
