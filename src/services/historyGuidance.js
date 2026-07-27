export function getHistoryGuidance({
  activeDayCount,
  totalJuiceCount,
  distinctProduceCount,
  firstLogDate,
  lastLogDate,
}) {
  const days = typeof activeDayCount === 'number' ? activeDayCount : 0
  const juices = typeof totalJuiceCount === 'number' ? totalJuiceCount : 0
  const produce = typeof distinctProduceCount === 'number' ? distinctProduceCount : null
  const first = typeof firstLogDate === 'string' ? firstLogDate : null
  const last = typeof lastLogDate === 'string' ? lastLogDate : null

  if (days === 0) {
    return {
      state: 'empty',
      title: 'Your juice history starts here',
      body: 'Log a juice by scanning produce or entering ingredients manually.',
      primaryAction: { label: 'Scan produce', target: 'scan' },
      secondaryAction: { label: 'Enter ingredients manually', target: 'manual' },
      summary: null,
    }
  }

  if (days === 1) {
    return {
      state: 'started',
      title: 'You\u2019ve started your flow',
      body: juices > 1
        ? `Your first logged day is saved with ${juices} juices. Keep adding juices whenever they fit your routine.`
        : 'Your first logged day is saved. Keep adding juices whenever they fit your routine.',
      primaryAction: null,
      secondaryAction: null,
      summary: { activeDays: days, totalJuices: juices, distinctProduce: produce, firstLogDate: first, lastLogDate: last },
    }
  }

  if (days >= 2 && days <= 6) {
    const parts = [`${days} active days`, `${juices} juice${juices !== 1 ? 's' : ''}`]
    if (produce !== null && produce > 0) {
      parts.push(`${produce} distinct produce item${produce !== 1 ? 's' : ''}`)
    }
    return {
      state: 'building',
      title: 'Your history is taking shape',
      body: parts.join(' \u00b7 '),
      primaryAction: null,
      secondaryAction: null,
      summary: { activeDays: days, totalJuices: juices, distinctProduce: produce, firstLogDate: first, lastLogDate: last },
    }
  }

  const rangeParts = []
  if (first && last) {
    rangeParts.push(`from ${first} to ${last}`)
  }

  const summaryParts = [
    `${days} active days logged`,
    `${juices} juice${juices !== 1 ? 's' : ''} logged`,
  ]
  if (produce !== null && produce > 0) {
    summaryParts.push(`${produce} distinct produce item${produce !== 1 ? 's' : ''}`)
  }
  if (rangeParts.length > 0) {
    summaryParts.push(rangeParts[0])
  }

  return {
    state: 'established',
    title: 'Your RawLifeFlow journey',
    body: summaryParts.join(' \u00b7 '),
    primaryAction: null,
    secondaryAction: null,
    summary: { activeDays: days, totalJuices: juices, distinctProduce: produce, firstLogDate: first, lastLogDate: last },
  }
}
