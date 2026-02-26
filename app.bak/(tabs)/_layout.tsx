// ─────────────────────────────────────────────────────────────
// app/(tabs)/_layout.tsx — Tab navigator for Home, Log, Profile
// ─────────────────────────────────────────────────────────────

import React from 'react'
import { Tabs } from 'expo-router'
import { Home, BookOpen, User } from 'lucide-react-native'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0D1117',
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 0.5,
          paddingTop: 4,
          height: 56,
        },
        tabBarActiveTintColor: '#81C784',
        tabBarInactiveTintColor: '#484F58',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          tabBarLabel: 'Log',
          tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
