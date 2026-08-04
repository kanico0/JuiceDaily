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

import React, { useMemo, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native'
import GardenArtwork from './GardenArtwork'
import { buildGardenVisualState, GARDEN_PALETTE } from './GardenVisualState'
import {
  getGardenSummary,
  getProduceByBed,
  getBedStages,
  getDiscoveredColors,
} from '../services/gardenService'
import {
  GARDEN_BEDS,
  GARDEN_COLORS,
  BED_METADATA,
  COLOR_METADATA,
  getBedForProduce,
  getColorForProduce,
} from '../constants/gardenTaxonomy'
import { PRODUCE_DATA } from '../services/JuiceEngine'
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
}) {
  const { width: screenWidth } = useWindowDimensions()
  const [selectedBed, setSelectedBed] = useState(null)

  const summary = useMemo(() => getGardenSummary(entries), [entries])
  const visualState = useMemo(() => buildGardenVisualState(summary), [summary])
  const produceByBed = useMemo(() => getProduceByBed(entries), [entries])
  const bedStages = useMemo(() => getBedStages(entries), [entries])
  const discoveredColors = useMemo(() => getDiscoveredColors(entries), [entries])

  const artworkSize = Math.min(screenWidth - 32, 380)

  const handleBedPress = useCallback((bedKey) => {
    setSelectedBed((prev) => (prev === bedKey ? null : bedKey))
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
          {/* Full artwork */}
          <View style={styles.artworkContainer}>
            <GardenArtwork
              visualState={visualState}
              size={artworkSize}
              isReduced={isReduced}
              highlightBed={selectedBed}
            />
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
  artworkContainer: {
    alignItems: 'center',
    paddingVertical: SEMANTIC_SPACE.md,
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
})

export default GardenDetail
