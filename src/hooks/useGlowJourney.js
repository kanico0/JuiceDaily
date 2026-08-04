import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { trackEvent } from '../services/AnalyticsService'
import { useGlowStreak, getGlowTodayKey } from '../services/glowStreak'
import { useJuiceLog } from '../services/JuiceLogStore'
import { getUnlockedIds } from '../services/achievements'
import {
  getWeeklyLeafStates,
  getWeeklyQualifyingDays,
  getLifetimeQualifyingDays,
  getJourneyStage,
  shouldCelebrateStage,
  markStageCelebrated,
  shouldCelebrateWeekly,
  markWeeklyCelebrated,
  initializeBaseline,
} from '../services/glowJourneyService'

export function useGlowJourney () {
  const glowStreak = useGlowStreak()
  const { entries } = useJuiceLog()
  const [showGlowJourneyDetail, setShowGlowJourneyDetail] = useState(false)
  const [unlockedAchievementIds, setUnlockedAchievementIds] = useState([])
  const [stageCelebration, setStageCelebration] = useState(null)
  const glowJourneyViewedRef = useRef(false)
  const prevLifetimeDaysRef = useRef(0)

  const glowJourneyEntries = entries
  const weeklyLeafStates = useMemo(() => getWeeklyLeafStates(glowJourneyEntries), [glowJourneyEntries])
  const weeklyQualifyingDays = useMemo(() => getWeeklyQualifyingDays(glowJourneyEntries), [glowJourneyEntries])
  const lifetimeQualifyingDays = useMemo(() => getLifetimeQualifyingDays(glowJourneyEntries), [glowJourneyEntries])
  const journeyStage = useMemo(() => getJourneyStage(lifetimeQualifyingDays), [lifetimeQualifyingDays])

  useEffect(() => {
    ;(async () => {
      await initializeBaseline(glowJourneyEntries)
      prevLifetimeDaysRef.current = lifetimeQualifyingDays
    })()
  }, [])

  useEffect(() => {
    if (glowJourneyViewedRef.current) return
    glowJourneyViewedRef.current = true
    trackEvent('glow_journey_viewed', {
      journey_stage_key: journeyStage?.key || 'none',
      weekly_goal: 3,
      weekly_completed_days: weeklyQualifyingDays,
      has_active_streak: glowStreak.count > 0,
    })
  }, [])

  useEffect(() => {
    if (lifetimeQualifyingDays < 1) return
    const prevDays = prevLifetimeDaysRef.current
    ;(async () => {
      const stageToCelebrate = await shouldCelebrateStage(lifetimeQualifyingDays, prevDays)
      if (stageToCelebrate) {
        trackEvent('glow_journey_stage_reached', {
          journey_stage_key: stageToCelebrate.key,
          lifetime_days: lifetimeQualifyingDays,
        })
        await markStageCelebrated(stageToCelebrate.key)
        setStageCelebration({ stage: stageToCelebrate, lifetimeDays: lifetimeQualifyingDays })
      }
      const weeklyCelebrate = await shouldCelebrateWeekly(glowJourneyEntries)
      if (weeklyCelebrate) {
        trackEvent('weekly_glow_completed', {
          weekly_completed_days: weeklyCelebrate.days,
          weekly_goal: 3,
        })
        await markWeeklyCelebrated(weeklyCelebrate.weekStart)
      }
    })()
    prevLifetimeDaysRef.current = lifetimeQualifyingDays
  }, [lifetimeQualifyingDays, glowJourneyEntries])

  useEffect(() => {
    ;(async () => {
      const ids = await getUnlockedIds()
      setUnlockedAchievementIds(ids)
    })()
  }, [])

  const handleGlowJourneyPress = useCallback(() => {
    trackEvent('glow_journey_tapped', {
      journey_stage_key: journeyStage?.key || 'none',
      destination: 'glow_journey_detail',
    })
    setShowGlowJourneyDetail(true)
  }, [journeyStage])

  return {
    glowStreak,
    entries: glowJourneyEntries,
    weeklyLeafStates,
    weeklyQualifyingDays,
    lifetimeQualifyingDays,
    journeyStage,
    showGlowJourneyDetail,
    setShowGlowJourneyDetail,
    unlockedAchievementIds,
    stageCelebration,
    setStageCelebration,
    handleGlowJourneyPress,
  }
}
