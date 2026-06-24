// Smart natural-language parser for the quick-add box.
//
// Understands, in any order, things like:
//   "Email Sarah !high #work tomorrow 9am"
//   "Pay rent #home on the 1st"
//   "Submit report by friday !!!"
//   "Buy milk #shopping today"
//
// Returns: { title, priority, tags, due }  (due is an ISO string or null)

const HIGH_WORDS = ['urgent', 'asap', 'important', 'critical', 'now', 'today!']
const LOW_WORDS = ['someday', 'maybe', 'eventually', 'whenever']

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
]

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function nextWeekday(targetIdx) {
  const now = startOfDay(new Date())
  const diff = (targetIdx - now.getDay() + 7) % 7 || 7
  now.setDate(now.getDate() + diff)
  return now
}

// Pull a time like "5pm", "9:30am", "17:00" out of the text. Mutates nothing;
// returns { hours, minutes, matched } or null.
function extractTime(text) {
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i)
  if (m) {
    let hours = parseInt(m[1], 10) % 12
    if (/pm/i.test(m[3])) hours += 12
    return { hours, minutes: m[2] ? parseInt(m[2], 10) : 0, matched: m[0] }
  }
  const m24 = text.match(/\b(\d{1,2}):(\d{2})\b/)
  if (m24) {
    return {
      hours: parseInt(m24[1], 10),
      minutes: parseInt(m24[2], 10),
      matched: m24[0]
    }
  }
  return null
}

// Find a recurrence phrase. Returns { recurrence, matched } or null.
// recurrence: { type: 'daily'|'weekly'|'weekdays'|'monthly', interval, weekday? }
function extractRecurrence(text) {
  const lower = text.toLowerCase()

  // every <weekday>  -> weekly on that day
  for (let i = 0; i < WEEKDAYS.length; i++) {
    const m = lower.match(new RegExp('\\bevery\\s+' + WEEKDAYS[i] + '\\b'))
    if (m) return { recurrence: { type: 'weekly', interval: 1, weekday: i }, matched: m[0] }
  }

  // every weekday / weekdays
  let m = lower.match(/\bevery\s+weekday\b|\bweekdays\b/)
  if (m) return { recurrence: { type: 'weekdays', interval: 1 }, matched: m[0] }

  // every N days/weeks/months  (N optional)
  m = lower.match(/\bevery\s+(\d+)?\s*(day|days|week|weeks|month|months)\b/)
  if (m) {
    const interval = m[1] ? parseInt(m[1], 10) : 1
    const unit = m[2].startsWith('week')
      ? 'weekly'
      : m[2].startsWith('month')
      ? 'monthly'
      : 'daily'
    return { recurrence: { type: unit, interval }, matched: m[0] }
  }

  // single-word forms
  m = lower.match(/\b(daily|everyday|weekly|monthly)\b/)
  if (m) {
    const map = { daily: 'daily', everyday: 'daily', weekly: 'weekly', monthly: 'monthly' }
    return { recurrence: { type: map[m[1]], interval: 1 }, matched: m[0] }
  }

  return null
}

// Given a recurrence with no explicit date, pick the first due date.
function defaultDueFor(recurrence) {
  if (recurrence.weekday != null) return nextWeekday(recurrence.weekday)
  const d = startOfDay(new Date())
  if (recurrence.type === 'weekdays') {
    do {
      d.setDate(d.getDate() + 1)
    } while (d.getDay() === 0 || d.getDay() === 6)
  } else if (recurrence.type === 'weekly') {
    d.setDate(d.getDate() + 7)
  } else if (recurrence.type === 'monthly') {
    d.setMonth(d.getMonth() + 1)
  }
  // daily -> today (d unchanged)
  return d
}

// Find a relative/absolute date phrase. Returns { date, matched } or null.
function extractDate(text) {
  const lower = text.toLowerCase()

  // today / tonight / tomorrow
  if (/\btomorrow\b/.test(lower)) {
    const d = startOfDay(new Date())
    d.setDate(d.getDate() + 1)
    return { date: d, matched: 'tomorrow' }
  }
  if (/\b(today|tonight)\b/.test(lower)) {
    return { date: startOfDay(new Date()), matched: RegExp.$1 }
  }

  // "in 3 days" / "in 2 weeks"
  const rel = lower.match(/\bin\s+(\d+)\s+(day|days|week|weeks)\b/)
  if (rel) {
    const n = parseInt(rel[1], 10)
    const d = startOfDay(new Date())
    d.setDate(d.getDate() + (rel[2].startsWith('week') ? n * 7 : n))
    return { date: d, matched: rel[0] }
  }

  // weekday names, optionally prefixed with "on"/"next"/"by"
  for (let i = 0; i < WEEKDAYS.length; i++) {
    const re = new RegExp('\\b(?:on |next |by )?' + WEEKDAYS[i] + '\\b')
    const m = lower.match(re)
    if (m) return { date: nextWeekday(i), matched: m[0] }
  }

  // explicit dates: 2026-06-30, 06/30, 30/06
  const iso = lower.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  if (iso) {
    return {
      date: startOfDay(new Date(+iso[1], +iso[2] - 1, +iso[3])),
      matched: iso[0]
    }
  }

  return null
}

export function parseSmartInput(raw) {
  let text = (raw || '').trim()
  if (!text) return { title: '', priority: 'none', tags: [], due: null }

  let priority = 'none'
  const tags = []
  let recurrence = null

  // --- recurrence (strip before date parsing so "every monday" wins) ---
  const recHit = extractRecurrence(text)
  if (recHit) {
    recurrence = recHit.recurrence
    const idx = text.toLowerCase().indexOf(recHit.matched)
    if (idx !== -1) text = text.slice(0, idx) + text.slice(idx + recHit.matched.length)
  }

  // --- tags: #word ---
  text = text.replace(/#([\p{L}\p{N}_-]+)/gu, (_, tag) => {
    tags.push(tag.toLowerCase())
    return ''
  })

  // --- explicit priority: !high / !med / !low or bang count ---
  const explicit = text.match(/!(high|h|med|medium|m|low|l)\b/i)
  if (explicit) {
    const v = explicit[1].toLowerCase()
    priority = v.startsWith('h') ? 'high' : v.startsWith('l') ? 'low' : 'medium'
    text = text.replace(explicit[0], '')
  } else {
    const bangs = text.match(/!{1,3}(?!\w)/)
    if (bangs) {
      const n = bangs[0].length
      priority = n >= 3 ? 'high' : n === 2 ? 'high' : 'medium'
      text = text.replace(bangs[0], '')
    }
  }

  // --- keyword-based priority (only if not already set) ---
  const lower = text.toLowerCase()
  if (priority === 'none') {
    if (HIGH_WORDS.some(w => lower.includes(w))) priority = 'high'
    else if (LOW_WORDS.some(w => lower.includes(w))) priority = 'low'
  }

  // --- due date + time ---
  // Find the time up front so it applies whether the date comes from an
  // explicit phrase ("tomorrow") or from a recurrence default ("every weekday").
  const timeHit = extractTime(text)

  let dueDate = null
  const dateHit = extractDate(text)
  if (dateHit) {
    dueDate = dateHit.date
    const idx = text.toLowerCase().indexOf(dateHit.matched)
    if (idx !== -1) {
      text = text.slice(0, idx) + text.slice(idx + dateHit.matched.length)
    }
  } else if (recurrence) {
    dueDate = defaultDueFor(recurrence)
  }

  let due = null
  if (dueDate) {
    if (timeHit) {
      dueDate.setHours(timeHit.hours, timeHit.minutes, 0, 0)
      text = text.replace(timeHit.matched, '')
    }
    due = dueDate.toISOString()
  }

  // tidy leftover title
  const title = text.replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim()

  return { title, priority, tags, due, recurrence }
}

// Advance a due date to the next occurrence for a recurrence rule.
export function nextOccurrence(iso, recurrence) {
  if (!recurrence) return null
  const d = iso ? new Date(iso) : new Date()
  const interval = recurrence.interval || 1
  switch (recurrence.type) {
    case 'daily':
      d.setDate(d.getDate() + interval)
      break
    case 'weekly':
      d.setDate(d.getDate() + 7 * interval)
      break
    case 'monthly':
      d.setMonth(d.getMonth() + interval)
      break
    case 'weekdays':
      do {
        d.setDate(d.getDate() + 1)
      } while (d.getDay() === 0 || d.getDay() === 6)
      break
    default:
      return null
  }
  return d.toISOString()
}
