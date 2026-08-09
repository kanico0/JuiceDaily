// ─────────────────────────────────────────────────────────────
// NotificationDetailScreen.js — Full notification content viewer.
//
// Displays the complete notification message (title, fullText,
// date/time, optional category) with proper wrapping, multi-
// paragraph support, scrolling for long content, and a Back
// action. No artificial two-line truncation.
//
// Route params:
//   notificationId  - archive record ID to look up
//   title           - fallback title if record not found
//   fullText        - fallback full text if record not found
//   notificationType - fallback category if record not found
//   scheduledFor    - fallback timestamp if record not found
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft } from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import { getNotificationRecord } from '../services/NotificationHistoryService'

const TYPE_LABELS = {
  affirmation: 'Daily Affirmation',
  educational: 'Educational Tip',
  streak_shield: 'Streak Shield',
  streakRisk: 'Streak Check-In',
  daily: 'Daily Glow',
  weekly: 'Weekly Summary',
  surprise: 'Surprise & Delight',
  weight_milestone: 'Weight Milestone',
  onboarding: 'Onboarding',
  test: 'Test Notification',
  dormant_reminder: 'Reminder',
}

function formatDate(ts) {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function NotificationDetailScreen({ route, navigation }) {
  const params = route?.params || {}
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        if (params.notificationId) {
          const r = await getNotificationRecord(params.notificationId)
          if (mounted) {
            setRecord(r)
            setLoading(false)
          }
        } else {
          if (mounted) setLoading(false)
        }
      } catch {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [params.notificationId])

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack()
    } else {
      navigation.navigate('TodayTab')
    }
  }, [navigation])

  // Resolve display values: prefer archive record, fall back to params
  const title = record?.title || params.title || 'Notification'
  const fullText = record?.fullText || params.fullText || params.body || ''
  const notificationType = record?.notificationType || params.notificationType || ''
  const scheduledFor = record?.scheduledFor ?? params.scheduledFor ?? null
  const createdAt = record?.createdAt ?? null
  const displayDate = formatDate(scheduledFor) || formatDate(createdAt)
  const typeLabel = TYPE_LABELS[notificationType] || notificationType || ''

  if (loading) {
    return (
      <View style={styles.rootWrap}>
        <MeshGradientBg />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={12}>
              <ArrowLeft size={22} color="#C9D1D9" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Notification</Text>
            <View style={styles.backBtn} />
          </View>
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#81C784" />
          </View>
        </SafeAreaView>
      </View>
    )
  }

  return (
    <View style={styles.rootWrap}>
      <MeshGradientBg />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={12}>
            <ArrowLeft size={22} color="#C9D1D9" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notification</Text>
          <View style={styles.backBtn} />
        </View>

        {/* ── Scrollable content ── */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {typeLabel ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{typeLabel}</Text>
            </View>
          ) : null}

          <Text style={styles.title} maxFontSizeMultiplier={1.4}>
            {title}
          </Text>

          {displayDate ? (
            <Text style={styles.dateText}>{displayDate}</Text>
          ) : null}

          {fullText ? (
            <Text style={styles.bodyText} maxFontSizeMultiplier={1.5}>
              {fullText}
            </Text>
          ) : (
            <Text style={styles.emptyBody}>
              This notification no longer has content available.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  rootWrap: { flex: 1, backgroundColor: '#060D0A' },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1B3A2A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 16,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#81C784',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#E6EDF3',
    lineHeight: 30,
    marginBottom: 8,
  },
  dateText: {
    fontSize: 13,
    color: '#8B949E',
    marginBottom: 20,
  },
  bodyText: {
    fontSize: 16,
    color: '#C9D1D9',
    lineHeight: 24,
  },
  emptyBody: {
    fontSize: 15,
    color: '#8B949E',
    lineHeight: 22,
    fontStyle: 'italic',
  },
})
