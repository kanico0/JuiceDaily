import { useState, useEffect, useRef, useCallback } from 'react'

const CELEBRATION_TYPES = {
  WEEKLY: 'weekly',
  STAGE: 'stage',
  GARDEN_DISCOVERY: 'garden_discovery',
  GARDEN_BED_MILESTONE: 'garden_bed_milestone',
  GARDEN_COLOR: 'garden_color',
  GARDEN_RAINBOW: 'garden_rainbow',
}

export { CELEBRATION_TYPES }

export function useCelebrationCoordinator() {
  const [activeCelebration, setActiveCelebration] = useState(null)
  const queueRef = useRef([])
  const processingRef = useRef(false)

  const processQueue = useCallback(() => {
    if (processingRef.current) return
    const next = queueRef.current.shift()
    if (!next) {
      setActiveCelebration(null)
      return
    }
    processingRef.current = true
    setActiveCelebration(next)
  }, [])

  const enqueue = useCallback((type, data) => {
    if (type === CELEBRATION_TYPES.STAGE) {
      queueRef.current = queueRef.current.filter(
        (item) => item.type !== CELEBRATION_TYPES.STAGE
      )
      queueRef.current.push({ type, data })
    } else if (type === CELEBRATION_TYPES.WEEKLY) {
      const hasStage = queueRef.current.some(
        (item) => item.type === CELEBRATION_TYPES.STAGE
      )
      if (!hasStage) {
        queueRef.current.push({ type, data })
      }
    } else if (type === CELEBRATION_TYPES.GARDEN_RAINBOW) {
      queueRef.current = queueRef.current.filter(
        (item) => item.type !== CELEBRATION_TYPES.GARDEN_RAINBOW
      )
      queueRef.current.push({ type, data })
    } else if (
      type === CELEBRATION_TYPES.GARDEN_DISCOVERY ||
      type === CELEBRATION_TYPES.GARDEN_BED_MILESTONE ||
      type === CELEBRATION_TYPES.GARDEN_COLOR
    ) {
      queueRef.current.push({ type, data })
    }
    processQueue()
  }, [processQueue])

  const dismiss = useCallback(() => {
    processingRef.current = false
    setActiveCelebration(null)
    processQueue()
  }, [processQueue])

  const clear = useCallback(() => {
    queueRef.current = []
    processingRef.current = false
    setActiveCelebration(null)
  }, [])

  useEffect(() => {
    return () => {
      queueRef.current = []
      processingRef.current = false
    }
  }, [])

  return {
    activeCelebration,
    enqueue,
    dismiss,
    clear,
    hasPending: queueRef.current.length > 0,
  }
}
