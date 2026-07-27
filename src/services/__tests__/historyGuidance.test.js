import { getHistoryGuidance } from '../historyGuidance'

describe('getHistoryGuidance', () => {
  test('zero active days returns empty state', () => {
    const result = getHistoryGuidance({
      activeDayCount: 0,
      totalJuiceCount: 0,
      distinctProduceCount: 0,
      firstLogDate: null,
      lastLogDate: null,
    })
    expect(result.state).toBe('empty')
    expect(result.title).toBe('Your juice history starts here')
    expect(result.body).toContain('Log a juice by scanning')
    expect(result.primaryAction).toBeTruthy()
    expect(result.primaryAction.label).toBe('Scan produce')
    expect(result.secondaryAction).toBeTruthy()
    expect(result.secondaryAction.label).toBe('Enter ingredients manually')
    expect(result.summary).toBeNull()
  })

  test('one active day returns started state', () => {
    const result = getHistoryGuidance({
      activeDayCount: 1,
      totalJuiceCount: 1,
      distinctProduceCount: 2,
      firstLogDate: '2026-01-15',
      lastLogDate: '2026-01-15',
    })
    expect(result.state).toBe('started')
    expect(result.title).toBe('You\u2019ve started your flow')
    expect(result.body).toContain('first logged day')
    expect(result.primaryAction).toBeNull()
    expect(result.secondaryAction).toBeNull()
    expect(result.summary).toBeTruthy()
    expect(result.summary.activeDays).toBe(1)
    expect(result.summary.totalJuices).toBe(1)
  })

  test('one active day with multiple juices mentions count', () => {
    const result = getHistoryGuidance({
      activeDayCount: 1,
      totalJuiceCount: 3,
      distinctProduceCount: 5,
      firstLogDate: '2026-01-15',
      lastLogDate: '2026-01-15',
    })
    expect(result.state).toBe('started')
    expect(result.body).toContain('3 juices')
  })

  test('two active days returns building state', () => {
    const result = getHistoryGuidance({
      activeDayCount: 2,
      totalJuiceCount: 4,
      distinctProduceCount: 6,
      firstLogDate: '2026-01-14',
      lastLogDate: '2026-01-15',
    })
    expect(result.state).toBe('building')
    expect(result.title).toBe('Your history is taking shape')
    expect(result.body).toContain('2 active days')
    expect(result.body).toContain('4 juices')
    expect(result.body).toContain('6 distinct produce items')
  })

  test('six active days returns building state', () => {
    const result = getHistoryGuidance({
      activeDayCount: 6,
      totalJuiceCount: 12,
      distinctProduceCount: 10,
      firstLogDate: '2026-01-10',
      lastLogDate: '2026-01-15',
    })
    expect(result.state).toBe('building')
    expect(result.body).toContain('6 active days')
    expect(result.body).toContain('12 juices')
  })

  test('seven active days returns established state', () => {
    const result = getHistoryGuidance({
      activeDayCount: 7,
      totalJuiceCount: 20,
      distinctProduceCount: 15,
      firstLogDate: '2026-01-09',
      lastLogDate: '2026-01-15',
    })
    expect(result.state).toBe('established')
    expect(result.title).toBe('Your RawLifeFlow journey')
    expect(result.body).toContain('7 active days logged')
    expect(result.body).toContain('20 juices logged')
    expect(result.body).toContain('15 distinct produce items')
    expect(result.body).toContain('from 2026-01-09 to 2026-01-15')
  })

  test('large established-history values', () => {
    const result = getHistoryGuidance({
      activeDayCount: 365,
      totalJuiceCount: 1000,
      distinctProduceCount: 120,
      firstLogDate: '2025-01-01',
      lastLogDate: '2026-01-01',
    })
    expect(result.state).toBe('established')
    expect(result.body).toContain('365 active days logged')
    expect(result.body).toContain('1000 juices logged')
    expect(result.body).toContain('120 distinct produce items')
  })

  test('missing distinct-produce data does not crash', () => {
    const result = getHistoryGuidance({
      activeDayCount: 3,
      totalJuiceCount: 5,
      distinctProduceCount: null,
      firstLogDate: '2026-01-13',
      lastLogDate: '2026-01-15',
    })
    expect(result.state).toBe('building')
    expect(result.body).not.toContain('distinct produce')
    expect(result.body).toContain('3 active days')
    expect(result.body).toContain('5 juices')
  })

  test('missing dates does not crash', () => {
    const result = getHistoryGuidance({
      activeDayCount: 10,
      totalJuiceCount: 30,
      distinctProduceCount: 8,
      firstLogDate: null,
      lastLogDate: null,
    })
    expect(result.state).toBe('established')
    expect(result.body).not.toContain('from')
    expect(result.body).toContain('10 active days logged')
  })

  test('no fabricated trend wording in any state', () => {
    const states = [
      { activeDayCount: 0, totalJuiceCount: 0, distinctProduceCount: 0, firstLogDate: null, lastLogDate: null },
      { activeDayCount: 1, totalJuiceCount: 1, distinctProduceCount: 1, firstLogDate: '2026-01-01', lastLogDate: '2026-01-01' },
      { activeDayCount: 3, totalJuiceCount: 5, distinctProduceCount: 4, firstLogDate: '2026-01-01', lastLogDate: '2026-01-03' },
      { activeDayCount: 30, totalJuiceCount: 60, distinctProduceCount: 20, firstLogDate: '2026-01-01', lastLogDate: '2026-01-30' },
    ]
    const bannedWords = ['improvement', 'trend', 'streak', 'consistency', 'nutrient gains', 'healthier', 'better', 'progress']
    states.forEach((s) => {
      const result = getHistoryGuidance(s)
      const fullText = (result.title + ' ' + result.body).toLowerCase()
      bannedWords.forEach((word) => {
        expect(fullText).not.toContain(word)
      })
    })
  })

  test('deterministic output for same input', () => {
    const input = {
      activeDayCount: 5,
      totalJuiceCount: 10,
      distinctProduceCount: 7,
      firstLogDate: '2026-01-10',
      lastLogDate: '2026-01-15',
    }
    const result1 = getHistoryGuidance(input)
    const result2 = getHistoryGuidance(input)
    expect(result1).toEqual(result2)
  })
})
