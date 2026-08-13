// ─────────────────────────────────────────────────────────────
// GardenDetail.js — Full-screen Garden detail experience.
// Shows the full artwork, tappable beds with info panels,
// color marker strip, and discovery stats.
//
// Follows the same detail pattern as the existing progress detail:
//   - Modal bottom sheet with scrollable content
//   - Semantic tokens for all colors
//   - Accessible labels for each bed
// ─────────────────────────────────────────────────────────────

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native'
import JourneyTreeArtwork, { TREE_DESCRIPTORS } from './JourneyTreeArtwork'
import MilestoneArborArtwork, { getArborEarnedCount, getArborSlotStates } from './MilestoneArborArtwork'
import { GARDEN_PALETTE } from './GardenVisualState'
import LivingGardenScene from './LivingGardenScene'
import {
  getGardenSummary,
  getProduceByBed,
  getBedStages,
  getDiscoveredColors,
  isRainbowHarvestComplete,
} from '../services/gardenService'
import {
  GARDEN_BEDS,
  GARDEN_COLORS,
  BED_METADATA,
  COLOR_METADATA,
  getColorForProduce,
} from '../constants/gardenTaxonomy'
import { PRODUCE_DATA } from '../services/JuiceEngine'
import { getJourneyStage } from '../constants/glowJourneyStages'
import { getLifetimeQualifyingDays } from '../services/glowJourneyService'
import {
  getLastSeenState,
  saveLastSeenState,
  initializeIfAbsent,
  detectAdvancements,
  buildCurrentSeenState,
  isIntroSeen,
  markIntroSeen,
} from '../services/gardenSeenState'
import {
  SEMANTIC_COLORS,
  SEMANTIC_TYPOGRAPHY,
  SEMANTIC_RADIUS,
  SEMANTIC_SHADOWS,
  SEMANTIC_SPACE,
} from '../constants/tokens'

function GardenDetail({
  visible,
  onClose,
  entries,
  isReduced = false,
  unlockedAchievementIds = [],
}) {
  const { width: screenWidth } = useWindowDimensions()
  const [selectedBed, setSelectedBed] = useState(null)

  const summary = useMemo(() => getGardenSummary(entries), [entries])
  const produceByBed = useMemo(() => getProduceByBed(entries), [entries])
  const bedStages = useMemo(() => getBedStages(entries), [entries])
  const discoveredColors = useMemo(() => getDiscoveredColors(entries), [entries])
  const rainbowComplete = useMemo(() => isRainbowHarvestComplete(entries), [entries])
  const lifetimeDays = useMemo(() => getLifetimeQualifyingDays(entries), [entries])
  const journeyStage = useMemo(() => getJourneyStage(lifetimeDays), [lifetimeDays])
  const journeyStageKey = journeyStage?.key || null

  const arborCtx = useMemo(() => ({
    unlockedAchievementIds,
    bedStages,
    rainbowComplete,
  }), [unlockedAchievementIds, bedStages, rainbowComplete])

  const arborEarned = useMemo(() => getArborEarnedCount(arborCtx), [arborCtx])
  const arborSlots = useMemo(() => getArborSlotStates(arborCtx), [arborCtx])

  const artworkSize = Math.min(screenWidth - 32, 380)

  // ── Living Garden seen-state + intro ────────────────────────
  const [showIntro, setShowIntro] = useState(false)
  const seenStateLoaded = useRef(false)

  // Current state for seen-state comparison
  const currentSeenState = useMemo(() => buildCurrentSeenState({
    bedStages,
    journeyStageKey,
    earnedMilestoneIds: unlockedAchievementIds,
  }), [bedStages, journeyStageKey, unlockedAchievementIds])

  // On first visible: initialize seen-state if absent, check intro
  useEffect(() => {
    if (!visible || seenStateLoaded.current) return
    seenStateLoaded.current = true
    let cancelled = false
    ;(async () => {
      const wasFirstOpen = await initializeIfAbsent(currentSeenState)
      if (cancelled) return
      if (!wasFirstOpen) {
        // Check for missed advancements (for future visual transitions)
        // For v1, we detect but the wake animation handles presentation
        const lastSeen = await getLastSeenState()
        if (lastSeen) {
          detectAdvancements(lastSeen, currentSeenState)
          // Advancements are detected; the scene's wake animation
          // provides the visual transition. Snapshot is updated below.
        }
      }
      // Show intro callouts if not yet seen
      const introSeen = await isIntroSeen()
      if (cancelled) return
      if (!introSeen) {
        setShowIntro(true)
      }
    })()
    return () => { cancelled = true }
  }, [visible, currentSeenState])

  // Update seen-state AFTER user has seen the Garden (on close)
  useEffect(() => {
    if (!visible && seenStateLoaded.current) {
      saveLastSeenState(currentSeenState)
    }
  }, [visible, currentSeenState])

  const handleDismissIntro = useCallback(() => {
    setShowIntro(false)
    markIntroSeen()
  }, [])

  const handleBedPress = useCallback((bedKey) => {
    setSelectedBed((prev) => (prev === bedKey ? null : bedKey))
  }, [])

  const handleTreePress = useCallback(() => {
    // Scroll to Journey Tree section or show tree detail
    setSelectedBed(null)
  }, [])

  const handleArborPress = useCallback(() => {
    // Scroll to Arbor section or show arbor detail
    setSelectedBed(null)
  }, [])

  const selectedBedData = selectedBed
    ? {
        key: selectedBed,
        meta: BED_METADATA[selectedBed],
        produce: produceByBed[selectedBed] || [],
        stage: bedStages[selectedBed],
      }
    : null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      accessible={true}
      accessibilityLabel="RawLife Garden detail view"
    >
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>RawLife Garden</Text>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close Garden detail"
            accessibilityRole="button"
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>Done</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Living Garden immersive scene */}
          <View style={styles.livingGardenContainer}>
            <LivingGardenScene
              bedStages={bedStages}
              journeyStageKey={journeyStageKey}
              arborCtx={arborCtx}
              isReduced={isReduced}
              onBedPress={handleBedPress}
              onTreePress={handleTreePress}
              onArborPress={handleArborPress}
              sceneId="garden-detail"
            />
          </View>

          {/* First-visit intro callouts (shown once) */}
          {showIntro && (
            <View style={styles.introOverlay}>
              <View style={styles.introCard}>
                <Text style={styles.introTitle}>Your Living Garden</Text>
                <Text style={styles.introItem}>
                  Your produce areas grow as you explore.
                </Text>
                <Text style={styles.introItem}>
                  Your Journey Tree will grow here.
                </Text>
                <Text style={styles.introItem}>
                  Your Arbor keeps the milestones you've earned.
                </Text>
                <Pressable
                  onPress={handleDismissIntro}
                  accessibilityLabel="Dismiss intro"
                  accessibilityRole="button"
                  style={styles.introButton}
                >
                  <Text style={styles.introButtonText}>Got it</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* How my Garden grows — help entry */}
          <View style={styles.guidanceBanner}>
            <Text style={styles.guidanceTitle}>How my Garden grows</Text>
            <Text style={styles.guidanceBody}>
              Every time you scan or log a juice, the produce you use is planted here.
              Discover new ingredients to grow new areas, unlock colors, and complete
              your Rainbow Harvest. Your Garden does not decay from inactivity —
              it only grows. Tap any area in the scene above to see what you've grown.
            </Text>
          </View>

          {/* Stats summary */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{summary.discoveredCount}</Text>
              <Text style={styles.statLabel}>Discoveries</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {summary.bedsStarted}/{summary.totalBeds}
              </Text>
              <Text style={styles.statLabel}>Areas</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {summary.discoveredColorCount}/{summary.totalColors}
              </Text>
              <Text style={styles.statLabel}>Colors</Text>
            </View>
          </View>

          {/* Rainbow Harvest badge */}
          {summary.rainbowComplete && (
            <View style={styles.rainbowBadge}>
              <Text style={styles.rainbowBadgeText}>
                Rainbow Harvest Complete
              </Text>
            </View>
          )}

          {/* Bed list */}
          <Text style={styles.sectionTitle}>Garden Areas</Text>
          {GARDEN_BEDS.map((bedKey) => {
            const meta = BED_METADATA[bedKey]
            const stage = bedStages[bedKey]
            const count = summary.bedCounts[bedKey]
            const isSelected = selectedBed === bedKey

            return (
              <Pressable
                key={bedKey}
                onPress={() => handleBedPress(bedKey)}
                accessibilityLabel={`${meta.label}: ${count} produce discovered, stage ${stage.label}`}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.bedItem,
                  isSelected && styles.bedItemSelected,
                  pressed && { opacity: 0.92 },
                ]}
              >
                <View style={styles.bedItemHeader}>
                  <Text style={styles.bedLabel}>{meta.label}</Text>
                  <Text style={styles.bedStage}>{stage.label}</Text>
                </View>
                <Text style={styles.bedCount}>
                  {count} {count === 1 ? 'discovery' : 'discoveries'}
                </Text>
              </Pressable>
            )
          })}

          {/* Selected bed detail */}
          {selectedBedData && (
            <View style={styles.bedDetailPanel}>
              <Text style={styles.bedDetailTitle}>
                {selectedBedData.meta.label}
              </Text>
              <Text style={styles.bedDetailDescription}>
                {selectedBedData.meta.description}
              </Text>
              <Text style={styles.bedDetailStage}>
                Stage: {selectedBedData.stage.label}
              </Text>
              {selectedBedData.produce.length > 0 ? (
                <View style={styles.produceList}>
                  {selectedBedData.produce.map((pid) => {
                    const entry = PRODUCE_DATA[pid]
                    const name = entry ? entry.name : pid
                    const color = getColorForProduce(pid)
                    return (
                      <View key={pid} style={styles.produceChip}>
                        <View
                          style={[
                            styles.produceDot,
                            { backgroundColor: GARDEN_PALETTE.glowColor },
                          ]}
                        />
                        <Text style={styles.produceName}>{name}</Text>
                      </View>
                    )
                  })}
                </View>
              ) : (
                <Text style={styles.emptyBedText}>
                  No produce discovered in this area yet
                </Text>
              )}
            </View>
          )}

          {/* Color markers */}
          <Text style={styles.sectionTitle}>Color Discovery</Text>
          <View style={styles.colorRow}>
            {GARDEN_COLORS.map((colorKey) => {
              const meta = COLOR_METADATA[colorKey]
              const discovered = discoveredColors.includes(colorKey)
              return (
                <View
                  key={colorKey}
                  style={styles.colorItem}
                  accessibilityLabel={`${meta.label} ${discovered ? 'discovered' : 'not yet discovered'}`}
                >
                  <View
                    style={[
                      styles.colorDot,
                      {
                        backgroundColor: discovered
                          ? getColorMarkerColorSafe(colorKey)
                          : 'rgba(255,255,255,0.08)',
                        opacity: discovered ? 1 : 0.3,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.colorLabel,
                      { opacity: discovered ? 1 : 0.4 },
                    ]}
                  >
                    {meta.label}
                  </Text>
                </View>
              )
            })}
          </View>

          {/* ── Journey Tree section ── */}
          <Text style={styles.sectionTitle}>Journey Tree</Text>
          <View style={styles.treeSection}>
            <View style={styles.treeArtworkWrap}>
              <JourneyTreeArtwork stageKey={journeyStageKey} size={120} />
            </View>
            <View style={styles.treeInfo}>
              <Text style={styles.treePrimaryLabel}>
                {journeyStage ? journeyStage.label : 'Seed'}
              </Text>
              <Text style={styles.treeSecondaryLabel}>
                {journeyStageKey ? TREE_DESCRIPTORS[journeyStageKey] : 'Seed'}
              </Text>
              <Text style={styles.treeDescription}>
                Your Journey Tree grows permanently with every juice you log.
                It never resets — even if your streak breaks.
              </Text>
              <Text style={styles.treeLifetimeDays}>
                {lifetimeDays} lifetime juicing {lifetimeDays === 1 ? 'day' : 'days'}
              </Text>
            </View>
          </View>

          {/* ── Milestone Arbor section ── */}
          <Text style={styles.sectionTitle}>Milestone Arbor</Text>
          <View style={styles.arborSection}>
            <View style={styles.arborArtworkWrap}>
              <MilestoneArborArtwork ctx={arborCtx} size={120} />
            </View>
            <View style={styles.arborInfo}>
              <Text style={styles.arborEarnedText}>
                {arborEarned} earned so far
              </Text>
              <Text style={styles.arborDescription}>
                Ornaments are earned by reaching lifetime milestones across
                your Garden and Glow Journey. Unearned slots appear as empty
                pegs — they fill in as you progress.
              </Text>
              <View style={styles.arborSlotList}>
                {arborSlots.map((slot) => (
                  <View key={slot.id} style={styles.arborSlotItem}>
                    <View style={[
                      styles.arborSlotDot,
                      { backgroundColor: slot.earned ? GARDEN_PALETTE.glowColor : 'rgba(255,255,255,0.08)' },
                    ]} />
                    <Text style={[
                      styles.arborSlotLabel,
                      { opacity: slot.earned ? 1 : 0.4 },
                    ]}>
                      {slot.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

// Helper to avoid importing from GardenVisualState (circular)
function getColorMarkerColorSafe(colorKey) {
  const colors = {
    green: '#81C784',
    red: '#E91E63',
    orange: '#FFB74D',
    yellow: '#FFD54F',
    purple: '#AB47BC',
    tan: '#D7CCB8',
  }
  return colors[colorKey] || '#90A4AE'
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: SEMANTIC_COLORS.canvas,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SEMANTIC_SPACE.lg,
    paddingVertical: SEMANTIC_SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: SEMANTIC_COLORS.borderSubtle,
  },
  headerTitle: {
    ...SEMANTIC_TYPOGRAPHY.screenTitle,
    color: SEMANTIC_COLORS.textPrimary,
  },
  closeButton: {
    paddingHorizontal: SEMANTIC_SPACE.md,
    paddingVertical: SEMANTIC_SPACE.sm,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
  },
  closeButtonText: {
    ...SEMANTIC_TYPOGRAPHY.buttonLabel,
    color: SEMANTIC_COLORS.accentPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SEMANTIC_SPACE.lg,
    paddingBottom: SEMANTIC_SPACE.xxxl,
  },
  guidanceBanner: {
    backgroundColor: SEMANTIC_COLORS.surface,
    borderRadius: SEMANTIC_RADIUS.large,
    paddingHorizontal: SEMANTIC_SPACE.md,
    paddingVertical: SEMANTIC_SPACE.md,
    marginBottom: SEMANTIC_SPACE.md,
  },
  guidanceTitle: {
    ...SEMANTIC_TYPOGRAPHY.bodyStrong,
    color: SEMANTIC_COLORS.textPrimary,
    marginBottom: 4,
  },
  guidanceBody: {
    ...SEMANTIC_TYPOGRAPHY.body,
    color: SEMANTIC_COLORS.textSecondary,
    lineHeight: 20,
  },
  artworkContainer: {
    alignItems: 'center',
    paddingVertical: SEMANTIC_SPACE.md,
  },
  livingGardenContainer: {
    alignItems: 'center',
    paddingVertical: SEMANTIC_SPACE.sm,
    backgroundColor: '#04100A',
    borderRadius: SEMANTIC_RADIUS.large,
    overflow: 'hidden',
  },
  introOverlay: {
    position: 'absolute',
    top: 180,
    left: 16,
    right: 16,
    zIndex: 10,
    alignItems: 'center',
  },
  introCard: {
    backgroundColor: 'rgba(10, 23, 16, 0.94)',
    borderRadius: SEMANTIC_RADIUS.large,
    paddingHorizontal: SEMANTIC_SPACE.lg,
    paddingVertical: SEMANTIC_SPACE.md,
    borderWidth: 1,
    borderColor: 'rgba(217, 164, 65, 0.3)',
    maxWidth: 340,
  },
  introTitle: {
    ...SEMANTIC_TYPOGRAPHY.cardTitle,
    color: '#F0D9A0',
    marginBottom: SEMANTIC_SPACE.sm,
    textAlign: 'center',
  },
  introItem: {
    ...SEMANTIC_TYPOGRAPHY.body,
    color: '#A8C4B0',
    marginBottom: 6,
    lineHeight: 18,
  },
  introButton: {
    marginTop: SEMANTIC_SPACE.sm,
    paddingHorizontal: SEMANTIC_SPACE.lg,
    paddingVertical: SEMANTIC_SPACE.sm,
    backgroundColor: 'rgba(217, 164, 65, 0.15)',
    borderRadius: SEMANTIC_RADIUS.medium,
    alignSelf: 'center',
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
  },
  introButtonText: {
    ...SEMANTIC_TYPOGRAPHY.buttonLabel,
    color: '#F0D9A0',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SEMANTIC_SPACE.md,
    backgroundColor: SEMANTIC_COLORS.surface,
    borderRadius: SEMANTIC_RADIUS.large,
    marginBottom: SEMANTIC_SPACE.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...SEMANTIC_TYPOGRAPHY.numericEmphasis,
    color: GARDEN_PALETTE.glowColor,
  },
  statLabel: {
    ...SEMANTIC_TYPOGRAPHY.caption,
    color: SEMANTIC_COLORS.textSecondary,
  },
  rainbowBadge: {
    backgroundColor: 'rgba(245,217,139,0.12)',
    borderRadius: SEMANTIC_RADIUS.medium,
    paddingHorizontal: SEMANTIC_SPACE.md,
    paddingVertical: SEMANTIC_SPACE.sm,
    marginBottom: SEMANTIC_SPACE.md,
    alignItems: 'center',
  },
  rainbowBadgeText: {
    ...SEMANTIC_TYPOGRAPHY.bodyStrong,
    color: GARDEN_PALETTE.particleColor,
  },
  sectionTitle: {
    ...SEMANTIC_TYPOGRAPHY.sectionTitle,
    color: SEMANTIC_COLORS.textPrimary,
    marginTop: SEMANTIC_SPACE.lg,
    marginBottom: SEMANTIC_SPACE.sm,
  },
  bedItem: {
    backgroundColor: SEMANTIC_COLORS.surface,
    borderRadius: SEMANTIC_RADIUS.medium,
    paddingHorizontal: SEMANTIC_SPACE.md,
    paddingVertical: SEMANTIC_SPACE.md,
    marginBottom: SEMANTIC_SPACE.sm,
    minHeight: 44,
  },
  bedItemSelected: {
    backgroundColor: SEMANTIC_COLORS.surfaceInteractive,
    borderWidth: 1,
    borderColor: GARDEN_PALETTE.glowColor,
  },
  bedItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bedLabel: {
    ...SEMANTIC_TYPOGRAPHY.bodyStrong,
    color: SEMANTIC_COLORS.textPrimary,
  },
  bedStage: {
    ...SEMANTIC_TYPOGRAPHY.caption,
    color: GARDEN_PALETTE.glowColor,
  },
  bedCount: {
    ...SEMANTIC_TYPOGRAPHY.body,
    color: SEMANTIC_COLORS.textSecondary,
    marginTop: 2,
  },
  bedDetailPanel: {
    backgroundColor: SEMANTIC_COLORS.surfaceRaised,
    borderRadius: SEMANTIC_RADIUS.large,
    padding: SEMANTIC_SPACE.md,
    marginTop: SEMANTIC_SPACE.sm,
    marginBottom: SEMANTIC_SPACE.lg,
  },
  bedDetailTitle: {
    ...SEMANTIC_TYPOGRAPHY.cardTitle,
    color: SEMANTIC_COLORS.textPrimary,
  },
  bedDetailDescription: {
    ...SEMANTIC_TYPOGRAPHY.body,
    color: SEMANTIC_COLORS.textSecondary,
    marginTop: 4,
  },
  bedDetailStage: {
    ...SEMANTIC_TYPOGRAPHY.caption,
    color: GARDEN_PALETTE.glowColor,
    marginTop: 4,
  },
  produceList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SEMANTIC_SPACE.sm,
    marginTop: SEMANTIC_SPACE.sm,
  },
  produceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SEMANTIC_COLORS.surfaceMuted,
    borderRadius: SEMANTIC_RADIUS.small,
    paddingHorizontal: SEMANTIC_SPACE.sm,
    paddingVertical: 4,
  },
  produceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  produceName: {
    ...SEMANTIC_TYPOGRAPHY.caption,
    color: SEMANTIC_COLORS.textPrimary,
  },
  emptyBedText: {
    ...SEMANTIC_TYPOGRAPHY.body,
    color: SEMANTIC_COLORS.textMuted,
    marginTop: SEMANTIC_SPACE.sm,
    fontStyle: 'italic',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SEMANTIC_SPACE.md,
    paddingVertical: SEMANTIC_SPACE.sm,
  },
  colorItem: {
    alignItems: 'center',
    minWidth: 50,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 4,
  },
  colorLabel: {
    ...SEMANTIC_TYPOGRAPHY.caption,
    color: SEMANTIC_COLORS.textSecondary,
  },
  treeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SEMANTIC_SPACE.md,
    backgroundColor: SEMANTIC_COLORS.surface,
    borderRadius: SEMANTIC_RADIUS.large,
    padding: SEMANTIC_SPACE.md,
    marginBottom: SEMANTIC_SPACE.md,
  },
  treeArtworkWrap: {
    flexShrink: 0,
  },
  treeInfo: {
    flex: 1,
  },
  treePrimaryLabel: {
    ...SEMANTIC_TYPOGRAPHY.cardTitle,
    color: SEMANTIC_COLORS.textPrimary,
  },
  treeSecondaryLabel: {
    ...SEMANTIC_TYPOGRAPHY.caption,
    color: GARDEN_PALETTE.particleColor,
    fontStyle: 'italic',
    marginTop: 2,
  },
  treeDescription: {
    ...SEMANTIC_TYPOGRAPHY.body,
    color: SEMANTIC_COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  treeLifetimeDays: {
    ...SEMANTIC_TYPOGRAPHY.bodyStrong,
    color: GARDEN_PALETTE.glowColor,
    marginTop: 4,
  },
  arborSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SEMANTIC_SPACE.md,
    backgroundColor: SEMANTIC_COLORS.surface,
    borderRadius: SEMANTIC_RADIUS.large,
    padding: SEMANTIC_SPACE.md,
    marginBottom: SEMANTIC_SPACE.md,
  },
  arborArtworkWrap: {
    flexShrink: 0,
  },
  arborInfo: {
    flex: 1,
  },
  arborEarnedText: {
    ...SEMANTIC_TYPOGRAPHY.cardTitle,
    color: GARDEN_PALETTE.particleColor,
  },
  arborDescription: {
    ...SEMANTIC_TYPOGRAPHY.body,
    color: SEMANTIC_COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  arborSlotList: {
    marginTop: SEMANTIC_SPACE.sm,
  },
  arborSlotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  arborSlotDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  arborSlotLabel: {
    ...SEMANTIC_TYPOGRAPHY.caption,
    color: SEMANTIC_COLORS.textPrimary,
  },
})

export default GardenDetail
