import React, { useRef, useEffect } from 'react'
import { TouchableOpacity, Text, StyleSheet, View, Animated } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Camera } from 'lucide-react-native'

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
          colors={['rgba(45,106,79,0.9)', 'rgba(27,67,50,0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Glass edge highlight */}
          <View style={styles.edgeGlow} />
          <Animated.View style={[styles.iconWrapper, { opacity: glowAnim }]}>
            <Camera size={26} color="#FFFFFF" strokeWidth={2.5} />
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
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    position: 'relative',
  },
  edgeGlow: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 1,
  },
  iconWrapper: {
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 10,
    borderRadius: 24,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
})
