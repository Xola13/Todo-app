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
  let due = null
  const dateHit = extractDate(text)
  if (dateHit) {
    const date = dateHit.date
    const timeHit = extractTime(text)
    if (timeHit) {
      date.setHours(timeHit.hours, timeHit.minutes, 0, 0)
      text = text.replace(timeHit.matched, '')
    }
    due = date.toISOString()
    // strip the matched date phrase (case-insensitive)
    const idx = text.toLowerCase().indexOf(dateHit.matched)
    if (idx !== -1) {
      text = text.slice(0, idx) + text.slice(idx + dateHit.matched.length)
    }
  }

  // tidy leftover title
  const title = text.replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim()

  return { title, priority, tags, due }
}
