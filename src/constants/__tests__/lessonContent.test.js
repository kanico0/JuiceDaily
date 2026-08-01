import {
  LESSONS,
  EXPERIENCE_LEVELS,
  getLesson,
  getLessonTitle,
  getLessonSections,
  LESSON_DISCLAIMER,
} from '../lessonContent'

describe('Feature Group 3 — Lesson Content Tests', () => {
  describe('Lesson data structure', () => {
    it('1. Each level maps to unique lesson content', () => {
      for (const level of EXPERIENCE_LEVELS) {
        const lesson = getLesson(level)
        expect(lesson).not.toBeNull()
        expect(lesson.level).toBe(level)
        expect(lesson.title).toBeTruthy()
        expect(lesson.sections.length).toBeGreaterThan(0)
      }

      // Verify uniqueness across levels
      const newLesson = getLesson('new')
      const casualLesson = getLesson('casual')
      const experiencedLesson = getLesson('experienced')

      expect(newLesson).not.toBe(casualLesson)
      expect(casualLesson).not.toBe(experiencedLesson)
      expect(newLesson).not.toBe(experiencedLesson)

      // Titles are distinct
      const titles = [newLesson.title, casualLesson.title, experiencedLesson.title]
      expect(new Set(titles).size).toBe(3)

      // Section IDs are distinct across lessons
      const newIds = newLesson.sections.map((s) => s.id)
      const casualIds = casualLesson.sections.map((s) => s.id)
      const experiencedIds = experiencedLesson.sections.map((s) => s.id)
      const allIds = [...newIds, ...casualIds, ...experiencedIds]
      expect(new Set(allIds).size).toBe(allIds.length)
    })

    it('2. Beginner content is not reused for Casual Juicer', () => {
      const newLesson = getLesson('new')
      const casualLesson = getLesson('casual')

      // No section headlines overlap
      const newHeadlines = new Set(newLesson.sections.map((s) => s.headline))
      const casualHeadlines = casualLesson.sections.map((s) => s.headline)
      for (const h of casualHeadlines) {
        expect(newHeadlines.has(h)).toBe(false)
      }

      // No section bodies overlap
      const newBodies = new Set(newLesson.sections.map((s) => s.body))
      const casualBodies = casualLesson.sections.map((s) => s.body)
      for (const b of casualBodies) {
        expect(newBodies.has(b)).toBe(false)
      }
    })

    it('3. Experienced Juicer receives a feature tour', () => {
      const lesson = getLesson('experienced')
      expect(lesson).not.toBeNull()

      const headlines = lesson.sections.map((s) => s.headline.toLowerCase())

      // Must cover the required feature-tour topics
      expect(headlines.some((h) => h.includes('advanced blend'))).toBe(true)
      expect(headlines.some((h) => h.includes('primary-produce') || h.includes('recipe discovery'))).toBe(true)
      expect(headlines.some((h) => h.includes('pagination') || h.includes('browsing'))).toBe(true)
      expect(headlines.some((h) => h.includes('wellness focus'))).toBe(true)
      expect(headlines.some((h) => h.includes('juicer') && h.includes('settings'))).toBe(true)
      expect(headlines.some((h) => h.includes('yield'))).toBe(true)
      expect(headlines.some((h) => h.includes('nutrition') && h.includes('quality'))).toBe(true)
      expect(headlines.some((h) => h.includes('organic'))).toBe(true)
      expect(headlines.some((h) => h.includes('history'))).toBe(true)
      expect(headlines.some((h) => h.includes('momentum') || h.includes('weekly'))).toBe(true)
      expect(headlines.some((h) => h.includes('pro'))).toBe(true)
    })

    it('4. Beginner lesson covers all required topics', () => {
      const lesson = getLesson('new')
      const headlines = lesson.sections.map((s) => s.headline.toLowerCase())

      expect(headlines.some((h) => h.includes('what is juicing'))).toBe(true)
      expect(headlines.some((h) => h.includes('simple juice'))).toBe(true)
      expect(headlines.some((h) => h.includes('three') || h.includes('four'))).toBe(true)
      expect(headlines.some((h) => h.includes('wash') || h.includes('prepar'))).toBe(true)
      expect(headlines.some((h) => h.includes('scan'))).toBe(true)
      expect(headlines.some((h) => h.includes('manual'))).toBe(true)
      expect(headlines.some((h) => h.includes('nutrition'))).toBe(true)
      expect(headlines.some((h) => h.includes('log'))).toBe(true)
    })

    it('5. Beginner lesson includes wellness disclaimer', () => {
      const lesson = getLesson('new')
      const bodies = lesson.sections.map((s) => s.body)
      expect(bodies.some((b) => b.includes(LESSON_DISCLAIMER))).toBe(true)
    })

    it('6. Casual juicer lesson covers all required topics', () => {
      const lesson = getLesson('casual')
      const headlines = lesson.sections.map((s) => s.headline.toLowerCase())

      expect(headlines.some((h) => h.includes('routine'))).toBe(true)
      expect(headlines.some((h) => h.includes('rotat'))).toBe(true)
      expect(headlines.some((h) => h.includes('high sugar'))).toBe(true)
      expect(headlines.some((h) => h.includes('focus nutrient'))).toBe(true)
      expect(headlines.some((h) => h.includes('wellness focus'))).toBe(true)
      expect(headlines.some((h) => h.includes('log') && h.includes('history'))).toBe(true)
      expect(headlines.some((h) => h.includes('advanced'))).toBe(true)
    })

    it('7. No unsupported medical or performance claims in experienced lesson', () => {
      const lesson = getLesson('experienced')
      const allText = lesson.sections.map((s) => `${s.headline} ${s.body}`).join(' ').toLowerCase()

      // Should not contain medical claims
      expect(allText).not.toContain('cure')
      expect(allText).not.toContain('treat')
      expect(allText).not.toContain('diagnos')
      expect(allText).not.toContain('prescribe')
      // Should not contain performance claims
      expect(allText).not.toContain('guaranteed results')
      expect(allText).not.toContain('miracle')
    })
  })

  describe('Helper functions', () => {
    it('getLessonTitle returns correct title for each level', () => {
      expect(getLessonTitle('new')).toBe('New to Juicing')
      expect(getLessonTitle('casual')).toBe('Casual Juicer')
      expect(getLessonTitle('experienced')).toBe('Experienced Juicer')
    })

    it('getLessonTitle returns empty string for unknown level', () => {
      expect(getLessonTitle('unknown')).toBe('')
    })

    it('getLessonSections returns sections array for valid level', () => {
      const sections = getLessonSections('new')
      expect(Array.isArray(sections)).toBe(true)
      expect(sections.length).toBeGreaterThan(0)
    })

    it('getLessonSections returns empty array for unknown level', () => {
      expect(getLessonSections('unknown')).toEqual([])
    })

    it('getLesson returns null for unknown level', () => {
      expect(getLesson('unknown')).toBeNull()
    })
  })

  describe('EXPERIENCE_LEVELS constant', () => {
    it('contains exactly 3 levels', () => {
      expect(EXPERIENCE_LEVELS).toEqual(['new', 'casual', 'experienced'])
      expect(EXPERIENCE_LEVELS.length).toBe(3)
    })
  })

  describe('Lesson section structure', () => {
    it('every section has id, headline, and body', () => {
      for (const level of EXPERIENCE_LEVELS) {
        const lesson = getLesson(level)
        for (const section of lesson.sections) {
          expect(section.id).toBeTruthy()
          expect(section.headline).toBeTruthy()
          expect(section.body).toBeTruthy()
          expect(typeof section.body).toBe('string')
          expect(section.body.length).toBeGreaterThan(20)
        }
      }
    })
  })
})
