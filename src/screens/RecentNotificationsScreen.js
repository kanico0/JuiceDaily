// ─────────────────────────────────────────────────────────────
// RecentNotificationsScreen.js — Recent notifications list.
//
// Displays the most recent 30 notifications, newest first.
// Each row shows title, short preview, and local date/time.
// Tapping a row opens NotificationDetailScreen with full text.
//
// Entry point: Settings → Notifications area → Recent Notifications
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, Bell } from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import {
  loadNotificationHistory,
  NOTIFICATION_HISTORY_MAX_ENTRIES,
} from '../services/NotificationHistoryService'

const PREVIEW_MAX_LENGTH = 80

function formatRelativeDate(ts) {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHr = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHr / 24)

    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHr < 24) return `${diffHr}h ago`
    if (diffDay === 1) return 'Yesterday'
    if (diffDay < 7) return `${diffDay}d ago`
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function truncatePreview(text) {
  if (!text) return ''
  const clean = String(text).replace(/\n+/g, ' ').trim()
  if (clean.length <= PREVIEW_MAX_LENGTH) return clean
  return clean.slice(0, PREVIEW_MAX_LENGTH).trimEnd() + '…'
}

export default function RecentNotificationsScreen({ navigation }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadHistory = useCallback(async () => {
    try {
      const history = await loadNotificationHistory()
      setRecords(history)
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Reload when screen comes into focus (returning from detail)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadHistory()
    })
    return unsubscribe
  }, [navigation, loadHistory])

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack()
    } else {
      navigation.navigate('Settings')
    }
  }, [navigation])

  const handleRowPress = useCallback(
    (record) => {
      navigation.navigate('NotificationDetail', {
        notificationId: record.id,
        title: record.title,
        fullText: record.fullText,
        notificationType: record.notificationType,
        scheduledFor: record.scheduledFor,
      })
    },
    [navigation],
  )

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    loadHistory()
  }, [loadHistory])

  const renderItem = useCallback(
    ({ item }) => (
      <TouchableOpacity
        style={styles.row}
        onPress={() => handleRowPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {item.title || 'Untitled'}
          </Text>
          <Text style={styles.rowPreview} numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {truncatePreview(item.fullText)}
          </Text>
          <Text style={styles.rowDate}>{formatRelativeDate(item.scheduledFor || item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    ),
    [handleRowPress],
  )

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyWrap}>
        <Bell size={40} color="#3A4A3A" />
        <Text style={styles.emptyTitle}>No recent notifications yet</Text>
        <Text style={styles.emptyDesc}>
          Your recent RawLifeFlow notifications will appear here.
        </Text>
      </View>
    ),
    [],
  )

  return (
    <View style={styles.rootWrap}>
      <MeshGradientBg />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={12}>
            <ArrowLeft size={22} color="#C9D1D9" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recent Notifications</Text>
          <View style={styles.backBtn} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#81C784" />
          </View>
        ) : (
          <FlatList
            data={records}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={records.length === 0 ? styles.emptyList : styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#81C784"
                colors={['#81C784']}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
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
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  emptyList: { flex: 1 },
  row: {
    backgroundColor: '#0E1A14',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1B2A20',
  },
  rowContent: { flex: 1 },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E6EDF3',
    marginBottom: 4,
  },
  rowPreview: {
    fontSize: 13,
    color: '#90A4AE',
    lineHeight: 18,
    marginBottom: 6,
  },
  rowDate: {
    fontSize: 11,
    color: '#5A6B5A',
    fontWeight: '600',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#8B949E',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#5A6B5A',
    textAlign: 'center',
    lineHeight: 20,
  },
})
