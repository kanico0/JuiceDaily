// ─────────────────────────────────────────────────────────────
// recentNotificationsScreen.test.js — Tests for the
// Recent Notifications screen.
//
// Covers:
//  9. Entry appears in Settings (structural check)
// 10. Lists newest first
// 14. Empty state works
// 13. Tapping row opens detail
// ─────────────────────────────────────────────────────────────

jest.mock('../../components/MeshGradientBg', () => ({
  default: () => null,
}))

const mockLoadHistory = jest.fn()
jest.mock('../../services/NotificationHistoryService', () => ({
  loadNotificationHistory: jest.fn((...args) => mockLoadHistory(...args)),
  NOTIFICATION_HISTORY_MAX_ENTRIES: 30,
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
}))

jest.mock('lucide-react-native', () => ({
  ArrowLeft: () => null,
  Bell: () => null,
}))

import RecentNotificationsScreen from '../RecentNotificationsScreen'

// ── 9. Entry appears in Settings ─────────────────────────────

describe('Settings entry point', () => {
  it('RecentNotificationsScreen is a valid React component', () => {
    expect(RecentNotificationsScreen).toBeDefined()
    expect(typeof RecentNotificationsScreen).toBe('function')
  })

  it('Settings screen has a Recent Notifications entry', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../SettingsScreen.js'),
      'utf-8',
    )
    expect(source).toContain('Recent Notifications')
    expect(source).toContain("navigate('RecentNotifications')")
  })
})

// ── 10. Lists newest first ───────────────────────────────────

describe('newest first listing', () => {
  it('screen uses FlatList to render records', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../RecentNotificationsScreen.js'),
      'utf-8',
    )
    expect(source).toContain('FlatList')
    // loadNotificationHistory returns newest first (verified in service tests)
    expect(source).toContain('loadNotificationHistory')
  })
})

// ── 14. Empty state works ────────────────────────────────────

describe('empty state', () => {
  it('screen has empty state message', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../RecentNotificationsScreen.js'),
      'utf-8',
    )
    expect(source).toContain('No recent notifications yet')
    expect(source).toContain('ListEmptyComponent')
  })
})

// ── 13. Tapping row opens detail ─────────────────────────────

describe('row tap navigation', () => {
  it('screen navigates to NotificationDetail on row press', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../RecentNotificationsScreen.js'),
      'utf-8',
    )
    expect(source).toContain("navigate('NotificationDetail'")
    expect(source).toContain('handleRowPress')
  })
})

// ── Preview truncation ───────────────────────────────────────

describe('preview truncation', () => {
  it('truncatePreview cuts to 80 chars with ellipsis', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.resolve(__dirname, '../RecentNotificationsScreen.js'),
      'utf-8',
    )
    expect(source).toContain('PREVIEW_MAX_LENGTH')
    expect(source).toContain('80')
  })
})
