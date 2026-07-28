// ─────────────────────────────────────────────────────────────
// ModernTabBar.js — Custom bottom tab bar with 3 tabs + centered FAB
// Layout: [Today] [History] [FAB] [Explore] [spacer]
// FAB triggers Scan flow as a modal (not a tab).
// ─────────────────────────────────────────────────────────────

import React, { useRef } from 'react'
import { View, Text, TouchableOpacity, Pressable, Animated, StyleSheet, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CalendarDays, History, Compass, Camera } from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { SEMANTIC_FAB } from '../constants/tokens'
import { useReducedMotion } from '../utils/motion'

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
const FAB_VISIBLE = 64
const FAB_TOUCH = 68
const FAB_BORDER_PRESSED = 'rgba(129,199,132,0.4)'

export default function ModernTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets()
  const rootNav = useNavigation()
  const isReduced = useReducedMotion()
  const scaleAnim = useRef(new Animated.Value(1)).current
  const bottomPad = Math.max(insets.bottom, 8)
  const barHeight = 56 + bottomPad

  const routes = state.routes
  const midIndex = Math.floor(routes.length / 2) // FAB goes after this index

  const handleFAB = () => {
    rootNav.navigate('ScanFlow')
  }

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    if (isReduced) return
    scaleAnim.stopAnimation()
    Animated.timing(scaleAnim, {
      toValue: 0.82,
      duration: 70,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    if (isReduced) return
    scaleAnim.stopAnimation()
    Animated.spring(scaleAnim, {
      toValue: 1,
      speed: 22,
      bounciness: 4,
      useNativeDriver: true,
    }).start()
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
                <Pressable
                  onPress={handleFAB}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  style={styles.fabTouch}
                  accessibilityRole="button"
                  accessibilityLabel="Scan produce"
                  accessibilityHint="Opens the camera to scan your produce"
                >
                  {({ pressed }) => (
                    <Animated.View
                      style={[
                        styles.fab,
                        {
                          transform: [{ scale: isReduced ? 1 : scaleAnim }],
                          backgroundColor: pressed
                            ? SEMANTIC_FAB.fabSurfacePressed
                            : SEMANTIC_FAB.fabSurface,
                          opacity: pressed ? 0.86 : 1,
                          borderColor: pressed
                            ? FAB_BORDER_PRESSED
                            : SEMANTIC_FAB.fabBorder,
                        },
                      ]}
                    >
                      <Camera size={26} color={SEMANTIC_FAB.fabIcon} />
                    </Animated.View>
                  )}
                </Pressable>
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
    width: FAB_TOUCH + 8,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  fabTouch: {
    width: FAB_TOUCH,
    height: FAB_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -34,
  },
  fab: {
    width: FAB_VISIBLE,
    height: FAB_VISIBLE,
    borderRadius: FAB_VISIBLE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      android: { elevation: SEMANTIC_FAB.fabShadow.elevation },
      ios: {
        shadowColor: SEMANTIC_FAB.fabShadow.shadowColor,
        shadowOffset: SEMANTIC_FAB.fabShadow.shadowOffset,
        shadowOpacity: SEMANTIC_FAB.fabShadow.shadowOpacity,
        shadowRadius: SEMANTIC_FAB.fabShadow.shadowRadius,
      },
    }),
  },
})
