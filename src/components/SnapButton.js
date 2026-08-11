import React, { useRef, useEffect } from 'react'
import { TouchableOpacity, Text, StyleSheet, View, Animated, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import SnapIcon from './SnapIcon'

export default function SnapButton({ onPress }) {
  const scaleAnim = useRef(new Animated.Value(0.95)).current
  const glowAnim = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      damping: 15,
      stiffness: 100,
      useNativeDriver: true,
    }).start()

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.7, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '100%' }}>
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#43A047', '#2E7D32', '#1B5E20']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.gradient}
        >
          <Animated.View style={[styles.iconWrapper, { opacity: glowAnim }]}>
            <SnapIcon size={48} color="#FFFFFF" />
          </Animated.View>
          <Text style={styles.label}>Snap Produce</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 28,
    overflow: 'hidden',
    ...Platform.select({
      android: { elevation: 8 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 28,
  },
  iconWrapper: {
    marginRight: 14,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
})
