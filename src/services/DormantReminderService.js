import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

const SETTINGS_KEY = '@notification_settings'
const ACTIVITY_KEY = '@dormant_reminder_last_activity'
let schedulingQueue = Promise.resolve()

const REMINDERS = [
  {
    id: 'dormant-reminder-day-7',
    days: 7,
    title: 'Ready to restart your Glow?',
    body: 'One simple juice is enough to start building momentum again.',
  },
  {
    id: 'dormant-reminder-day-14',
    days: 14,
    title: 'Your progress is still here',
    body: 'Return whenever you’re ready. Today can be a fresh start.',
  },
  {
    id: 'dormant-reminder-day-30',
    days: 30,
    title: 'Add a little more raw today',
    body: 'RawLifeFlow makes it easy to restart with one juice.',
  },
  {
    id: 'dormant-reminder-day-60',
    days: 60,
    title: 'Your RawLifeFlow journey is waiting',
    body: 'One small step is enough to begin again.',
  },
]

function getTriggerDate(activityDate, days) {
  return new Date(activityDate.getTime() + days * 24 * 60 * 60 * 1000)
}

async function getComebackRemindersEnabled() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY)
    return raw ? JSON.parse(raw).comebackReminders !== false : true
  } catch {
    return true
  }
}

export async function cancelDormantReminders() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    const reminderIds = new Set(REMINDERS.map(({ id }) => id))
    await Promise.all(scheduled
      .filter(({ identifier }) => reminderIds.has(identifier))
      .map(({ identifier }) => Notifications.cancelScheduledNotificationAsync(identifier)))
  } catch {}
}

function scheduleDormantReminders(activityDate) {
  schedulingQueue = schedulingQueue.catch(() => {}).then(async () => {
    await cancelDormantReminders()
    const now = Date.now()
    await Promise.all(REMINDERS.map(async (reminder) => {
      const triggerDate = getTriggerDate(activityDate, reminder.days)
      if (triggerDate.getTime() <= now) return
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: reminder.id,
          content: {
            title: reminder.title,
            body: reminder.body,
            data: { type: 'dormant_reminder', action: 'open_quick_log' },
            sound: 'glass_clink.wav',
            ...(Platform.OS === 'android' ? { channelId: 'nudges' } : {}),
          },
          trigger: { date: triggerDate },
        })
      } catch {}
    }))
  })
  return schedulingQueue
}

export async function recordMeaningfulActivity() {
  const activityDate = new Date()
  await AsyncStorage.setItem(ACTIVITY_KEY, activityDate.toISOString())
  if (await getComebackRemindersEnabled()) {
    await scheduleDormantReminders(activityDate)
  } else {
    await cancelDormantReminders()
  }
}

export async function reconcileDormantReminders() {
  if (!(await getComebackRemindersEnabled())) {
    await cancelDormantReminders()
    return
  }
  const storedActivity = await AsyncStorage.getItem(ACTIVITY_KEY)
  if (!storedActivity) return
  const activityDate = new Date(storedActivity)
  if (Number.isNaN(activityDate.getTime())) {
    await AsyncStorage.removeItem(ACTIVITY_KEY)
    await cancelDormantReminders()
    return
  }
  await scheduleDormantReminders(activityDate)
}

export async function setComebackRemindersEnabled(enabled) {
  if (!enabled) {
    await cancelDormantReminders()
    return
  }
  const storedActivity = await AsyncStorage.getItem(ACTIVITY_KEY)
  if (!storedActivity) return
  const activityDate = new Date(storedActivity)
  if (!Number.isNaN(activityDate.getTime())) {
    await scheduleDormantReminders(activityDate)
  }
}
