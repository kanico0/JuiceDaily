// ─────────────────────────────────────────────────────────────
// ModernTabBar.js — Custom bottom tab bar with 3 tabs + centered FAB
// Layout: [Today] [History] [FAB] [Explore] [spacer]
// FAB triggers Scan flow as a modal (not a tab).
// ─────────────────────────────────────────────────────────────

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CalendarDays, History, Compass, Scan } from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'

const TAB_ICONS = {
  TodayTab: CalendarDays,
  HistoryTab: History,
  ExploreTab: Compass,
}

const TAB_LABELS = {
  TodayTab: 'Today',
  HistoryTab: 'History',
  ExploreTab: 'Explore',
}

const ACTIVE_COLOR = '#81C784'
const INACTIVE_COLOR = '#484F58'
const BAR_BG = '#0D1117'
const FAB_SIZE = 56
const FAB_COLOR = '#4CAF50'

export default function ModernTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets()
  const rootNav = useNavigation()
  const bottomPad = Math.max(insets.bottom, 8)
  const barHeight = 56 + bottomPad

  const routes = state.routes
  const midIndex = Math.floor(routes.length / 2) // FAB goes after this index

  const handleFAB = () => {
    rootNav.navigate('ScanFlow')
  }

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPad, height: barHeight }]}>
      {/* Tab buttons with FAB gap in the center */}
      {routes.map((route, index) => {
        const { options } = descriptors[route.key]
        const isFocused = state.index === index
        const Icon = TAB_ICONS[route.name]
        const label = TAB_LABELS[route.name] || route.name
        const color = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }

        return (
          <React.Fragment key={route.key}>
            {/* Insert FAB after the middle tab */}
            {index === midIndex && (
              <View style={styles.fabSlot}>
                <TouchableOpacity
                  style={styles.fab}
                  onPress={handleFAB}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Scan produce"
                >
                  <Scan size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={styles.tabBtn}
              onPress={onPress}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={label}
            >
              {Icon && <Icon size={22} color={color} />}
              <Text style={[styles.label, { color }]}>{label}</Text>
            </TouchableOpacity>
          </React.Fragment>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: BAR_BG,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
    ...Platform.select({
      android: { elevation: 16 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
    }),
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  fabSlot: {
    width: FAB_SIZE + 16,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: FAB_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    ...Platform.select({
      android: { elevation: 12 },
      ios: {
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
    }),
  },
})
