// ─────────────────────────────────────────────────────────────
// MonthlyWrapScreen.js — "Spotify Wrapped" for Juicing
// 9:16 shareable card with mosaic, stats, archetype, share
// ─────────────────────────────────────────────────────────────

import React, { useState, useMemo, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Share,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Share2,
  Download,
  Trophy,
  Flame,
  Droplets,
  Zap,
} from 'lucide-react-native'
import {
  useChallenge,
  WEEKLY_COLORS,
  DAILY_PILLARS,
  ARCHETYPES,
  computeMonthlyStats,
} from '../services/ChallengeStore'
import MeshGradientBg from '../components/MeshGradientBg'
import { useFormatWeight } from '../utils/weightFormat'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ── Mosaic Grid (7×5 daily squares) ─────────────────────────

function MosaicGrid({ dailySquares }) {
  // Arrange into rows of 7
  const rows = []
  for (let i = 0; i < dailySquares.length; i += 7) {
    rows.push(dailySquares.slice(i, i + 7))
  }

  return (
    <View style={styles.mosaicContainer}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.mosaicRow}>
          {row.map((sq) => {
            const colorHex = sq.dominantColor
              ? WEEKLY_COLORS[sq.dominantColor]?.color
              : null
            return (
              <View
                key={sq.date}
                style={[
                  styles.mosaicSquare,
                  sq.hasData && colorHex && { backgroundColor: colorHex },
                  sq.isRainbow && styles.mosaicSquareRainbow,
                ]}
              />
            )
          })}
          {/* Pad short rows */}
          {row.length < 7 && Array.from({ length: 7 - row.length }).map((_, i) => (
            <View key={`pad-${i}`} style={styles.mosaicSquare} />
          ))}
        </View>
      ))}
    </View>
  )
}

// ── Color Spectrum Bar ──────────────────────────────────────

function SpectrumBar({ colorCounts }) {
  const total = Object.values(colorCounts).reduce((s, v) => s + v, 0)
  if (total === 0) return null

  const segments = Object.entries(WEEKLY_COLORS)
    .map(([key, data]) => ({
      key,
      color: data.color,
      count: colorCounts[key] || 0,
      pct: ((colorCounts[key] || 0) / total) * 100,
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)

  return (
    <View style={styles.spectrumWrap}>
      <Text style={styles.spectrumLabel}>YOUR SPECTRUM</Text>
      <View style={styles.spectrumBar}>
        {segments.map((seg) => (
          <View
            key={seg.key}
            style={[
              styles.spectrumSegment,
              { backgroundColor: seg.color, flex: seg.pct },
            ]}
          />
        ))}
      </View>
      <View style={styles.spectrumLegend}>
        {segments.slice(0, 4).map((seg) => (
          <View key={seg.key} style={styles.spectrumLegendItem}>
            <View style={[styles.spectrumLegendDot, { backgroundColor: seg.color }]} />
            <Text style={styles.spectrumLegendText}>
              {WEEKLY_COLORS[seg.key]?.label} {Math.round(seg.pct)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ── Stat Card ───────────────────────────────────────────────

function StatCard({ icon, value, label, color }) {
  return (
    <View style={styles.statCard}>
      {icon}
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

// ── Main Screen ──────────────────────────────────────────────

export default function MonthlyWrapScreen({ navigation }) {
  const { challenge } = useChallenge()
  const { fmtLbs, fmtG } = useFormatWeight()
  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const cardRef = useRef(null)

  const monthlyStats = useMemo(
    () => computeMonthlyStats(challenge, viewYear, viewMonth),
    [challenge, viewYear, viewMonth]
  )

  const userName = challenge.userName || 'Architect'

  // Navigate months
  const goToPrevMonth = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }, [viewMonth])

  const goToNextMonth = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const isCurrentMonth = viewMonth === now.getMonth() && viewYear === now.getFullYear()
    if (isCurrentMonth) return
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }, [viewMonth, viewYear])

  const isCurrentMonth = viewMonth === now.getMonth() && viewYear === now.getFullYear()

  // Share functionality
  const handleShare = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    try {
      if (cardRef.current) {
        const uri = await captureRef(cardRef, {
          format: 'png',
          quality: 1,
          width: 1080,
          height: 1920,
        })
        const isAvailable = await Sharing.isAvailableAsync()
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Share your Monthly Wrap',
          })
        }
      }
    } catch (e) {
      // Fallback to text share
      await Share.share({
        message: `🧃 My ${MONTH_NAMES[viewMonth]} Vitality Wrap:\n${monthlyStats.vitalityPercent}% Optimized · ${monthlyStats.totalJuices} juices · ${monthlyStats.archetype}\n\n#JuicingDaily #VitalityWrap`,
      })
    }
  }, [viewMonth, monthlyStats])

  // Gradient colors from top 3 consumed colors
  const bgGradient = useMemo(() => {
    const colors = monthlyStats.topThreeColors.map((c) => WEEKLY_COLORS[c]?.color || '#0D1117')
    while (colors.length < 3) colors.push('#0D1117')
    return colors
  }, [monthlyStats.topThreeColors])

  const weightLbs = fmtLbs(monthlyStats.totalWeightG)

  return (
    <View style={styles.root}>
      <MeshGradientBg />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={goToPrevMonth} style={styles.monthArrow}>
              <ChevronLeft size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity
              onPress={goToNextMonth}
              style={[styles.monthArrow, isCurrentMonth && { opacity: 0.3 }]}
              disabled={isCurrentMonth}
            >
              <ChevronRight size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <Share2 size={18} color="#81C784" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ═══ THE WRAP CARD (capturable for share) ═══════════ */}
          <View ref={cardRef} collapsable={false} style={styles.wrapCard}>
            <LinearGradient
              colors={[bgGradient[0] + '40', bgGradient[1] + '30', bgGradient[2] + '20', '#0D1117']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.wrapGradient}
            >
              {/* Identity Badge */}
              <View style={styles.identityBadge}>
                <Text style={styles.identityLabel}>WELLNESS ARCHITECT</Text>
                <Text style={styles.identityName}>{userName}</Text>
              </View>

              {/* Hero Stat */}
              <View style={styles.heroStat}>
                <Text style={styles.heroValue}>{monthlyStats.vitalityPercent}%</Text>
                <Text style={styles.heroLabel}>TOTAL VITALITY</Text>
                <Text style={styles.heroSubtitle}>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </Text>
              </View>

              {/* Mosaic */}
              <View style={styles.mosaicSection}>
                <Text style={styles.mosaicTitle}>THE MONTH IN COLOR</Text>
                <MosaicGrid dailySquares={monthlyStats.dailySquares} />
              </View>

              {/* Stats Row */}
              <View style={styles.statsRow}>
                <StatCard
                  icon={<Flame size={18} color="#FF9800" />}
                  value={monthlyStats.totalJuices}
                  label="Juices"
                  color="#FF9800"
                />
                <StatCard
                  icon={<Droplets size={18} color="#64B5F6" />}
                  value={weightLbs}
                  label="Produce"
                  color="#64B5F6"
                />
                <StatCard
                  icon={<Zap size={18} color="#81C784" />}
                  value={monthlyStats.totalRings}
                  label="Rings"
                  color="#81C784"
                />
              </View>

              {/* Archetype */}
              <View style={styles.archetypeSection}>
                <Text style={styles.archetypeEmoji}>{monthlyStats.archetypeEmoji}</Text>
                <Text style={styles.archetypeTitle}>{monthlyStats.archetype}</Text>
                {monthlyStats.topIngredient && (
                  <Text style={styles.archetypeDesc}>
                    Most-used: {monthlyStats.topIngredient.replace(/_/g, ' ')}
                  </Text>
                )}
              </View>

              {/* Spectrum Bar */}
              <SpectrumBar colorCounts={monthlyStats.colorCounts} />

              {/* The Big Flex */}
              {monthlyStats.totalJuices > 0 && (
                <View style={styles.flexCard}>
                  <Trophy size={16} color="#FFD54F" />
                  <Text style={styles.flexText}>
                    You processed {weightLbs} of produce this month
                  </Text>
                </View>
              )}

              {/* Hero Ingredients */}
              {monthlyStats.heroIngredients.length > 0 && (
                <View style={styles.heroIngSection}>
                  <Text style={styles.heroIngTitle}>TOP INGREDIENTS</Text>
                  <View style={styles.heroIngList}>
                    {monthlyStats.heroIngredients.slice(0, 5).map((ing, i) => (
                      <View key={ing.id} style={styles.heroIngRow}>
                        <Text style={styles.heroIngRank}>#{i + 1}</Text>
                        <Text style={styles.heroIngName}>
                          {ing.id.replace(/_/g, ' ')}
                        </Text>
                        <Text style={styles.heroIngWeight}>
                          {fmtLbs(ing.weight)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Branding footer */}
              <View style={styles.brandFooter}>
                <Text style={styles.brandText}>🧃 RawLifeFlow: Juicing Daily</Text>
                <Text style={styles.brandSub}>Start your 7-Day Rainbow</Text>
              </View>
            </LinearGradient>
          </View>

          {/* Share Button */}
          <TouchableOpacity
            style={styles.shareBtnLarge}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#4CAF50', '#2E7D32']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.shareBtnGradient}
            >
              <Share2 size={20} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>Share to Story</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Empty state */}
          {monthlyStats.totalJuices === 0 && (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>📅</Text>
              <Text style={styles.emptyTitle}>No data for {MONTH_NAMES[viewMonth]}</Text>
              <Text style={styles.emptyDesc}>
                Start juicing to build your monthly wrap!
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060D0A' },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthArrow: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    minWidth: 140,
    textAlign: 'center',
  },
  shareBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(129,199,132,0.08)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(129,199,132,0.2)',
  },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4 },

  // Wrap Card
  wrapCard: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  wrapGradient: {
    padding: 24,
    gap: 20,
  },

  // Identity
  identityBadge: {
    alignItems: 'center',
    marginBottom: 4,
  },
  identityLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#81C784',
    letterSpacing: 2,
  },
  identityName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
  },

  // Hero Stat
  heroStat: {
    alignItems: 'center',
  },
  heroValue: {
    fontSize: 72,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -3,
    lineHeight: 80,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#81C784',
    letterSpacing: 2,
    marginTop: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#484F58',
    marginTop: 2,
  },

  // Mosaic
  mosaicSection: {
    alignItems: 'center',
  },
  mosaicTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#484F58',
    letterSpacing: 2,
    marginBottom: 10,
  },
  mosaicContainer: {
    gap: 3,
    width: '100%',
  },
  mosaicRow: {
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
  },
  mosaicSquare: {
    width: 28,
    height: 28,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  mosaicSquareRainbow: {
    borderWidth: 1.5,
    borderColor: '#FFD54F',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#484F58',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Archetype
  archetypeSection: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 22,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  archetypeEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  archetypeTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  archetypeDesc: {
    fontSize: 13,
    color: '#8B949E',
    marginTop: 4,
    textTransform: 'capitalize',
  },

  // Spectrum Bar
  spectrumWrap: {
    gap: 8,
  },
  spectrumLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#484F58',
    letterSpacing: 2,
  },
  spectrumBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  spectrumSegment: {
    height: '100%',
  },
  spectrumLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  spectrumLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spectrumLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  spectrumLegendText: {
    fontSize: 11,
    color: '#8B949E',
    fontWeight: '600',
  },

  // Big Flex
  flexCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,213,79,0.06)',
    borderRadius: 24,
    padding: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,213,79,0.12)',
  },
  flexText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFD54F',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
  },

  // Hero Ingredients
  heroIngSection: {
    gap: 10,
  },
  heroIngTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#484F58',
    letterSpacing: 2,
  },
  heroIngList: {
    gap: 6,
  },
  heroIngRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroIngRank: {
    fontSize: 12,
    fontWeight: '800',
    color: '#81C784',
    width: 24,
  },
  heroIngName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#C9D1D9',
    textTransform: 'capitalize',
  },
  heroIngWeight: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B949E',
  },

  // Brand Footer
  brandFooter: {
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  brandText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#81C784',
  },
  brandSub: {
    fontSize: 11,
    color: '#484F58',
    marginTop: 2,
  },

  // Share Button
  shareBtnLarge: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  shareBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Empty
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  emptyDesc: { fontSize: 14, color: '#8B949E', textAlign: 'center' },
})
