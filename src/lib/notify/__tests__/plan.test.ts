import { describe, expect, it } from 'vitest'
import { planStudent, planTeacher, type StudentPlanInput } from '../plan'
import { compose, COPY, DAILY_CAP } from '../copy'

// A Wednesday morning, local time.
const NOW = new Date(2026, 2, 4, 9, 0)

const student = (over: Partial<StudentPlanInput> = {}): StudentPlanInput => ({
  role: 'student', now: NOW, on: {}, name: 'Ana', instrument: 'piano', teacherName: 'Chen',
  reminderTime: '17:00', streak: 12, todayLit: false, todayMinutes: 0, goalMinutes: 20, freezes: 1,
  favouritePiece: 'Minuet', performances: [], assignments: [], lessons: [], ...over,
})
const sameDay = (ms: number, d: Date) => new Date(ms).toDateString() === d.toDateString()

describe('the student’s week of reminders', () => {
  it('reminds today while today is unlit, at the chosen time', () => {
    const items = planStudent(student())
    const today = items.filter((i) => sameDay(i.at, NOW))
    expect(today.map((i) => i.kind)).toContain('streak-daily')
    expect(new Date(today.find((i) => i.kind === 'streak-daily')!.at).getHours()).toBe(17)
  })

  it('practising today removes today’s reminders (the replan simply has none)', () => {
    const items = planStudent(student({ todayLit: true }))
    expect(items.filter((i) => sameDay(i.at, NOW) && i.kind.startsWith('streak-'))).toHaveLength(0)
    expect(items.some((i) => i.kind === 'streak-frozen' || i.kind === 'streak-lost')).toBe(false)
  })

  it('with no freeze left, a late “2 hours left”, allowed through quiet hours', () => {
    const items = planStudent(student({ freezes: 0 }))
    const danger = items.find((i) => i.kind === 'streak-danger')!
    expect(new Date(danger.at).getHours()).toBe(22)
    expect(danger.passive).toBe(false)
    expect(planStudent(student({ freezes: 1 })).some((i) => i.kind === 'streak-danger')).toBe(false)
  })

  it('the late alert can be switched off', () => {
    expect(planStudent(student({ freezes: 0, on: { lateStreak: false } })).some((i) => i.kind === 'streak-danger')).toBe(false)
  })

  it('tomorrow morning: “a freeze saved you”, or “your streak ended”', () => {
    expect(planStudent(student({ freezes: 1 })).some((i) => i.kind === 'streak-frozen')).toBe(true)
    expect(planStudent(student({ freezes: 0 })).some((i) => i.kind === 'streak-lost')).toBe(true)
  })

  it('never more than three a day, exempt ones aside', () => {
    const items = planStudent(student({
      freezes: 0,
      assignments: [{ title: 'Scales', due: '2026-03-04' }, { title: 'Etude', due: '2026-03-04' }],
      lessons: [{ at: new Date(2026, 2, 4, 18).getTime(), minutes: 30 }],
    }))
    const byDay = new Map<string, number>()
    for (const i of items) {
      if (COPY[i.kind].exempt) continue
      const k = new Date(i.at).toDateString()
      byDay.set(k, (byDay.get(k) ?? 0) + 1)
    }
    for (const n of byDay.values()) expect(n).toBeLessThanOrEqual(DAILY_CAP)
  })

  it('a switched-off category plans nothing of it', () => {
    const items = planStudent(student({ on: { streak: false } }))
    expect(items.some((i) => COPY[i.kind].cat === 'streak')).toBe(false)
  })

  it('nothing in the past, nothing beyond a week', () => {
    for (const i of planStudent(student())) {
      expect(i.at).toBeGreaterThan(NOW.getTime())
      expect(i.at).toBeLessThanOrEqual(NOW.getTime() + 7 * 86_400_000)
    }
  })

  it('lessons: the evening before and an hour before', () => {
    const lesson = new Date(2026, 2, 6, 16, 30).getTime()
    const items = planStudent(student({ on: { streak: false }, lessons: [{ at: lesson, minutes: 45 }] }))
    expect(items.find((i) => i.kind === 'lesson-soon')!.at).toBe(lesson - 3_600_000)
    expect(new Date(items.find((i) => i.kind === 'lesson-tomorrow')!.at).getDate()).toBe(5)
  })

  it('reminders keep their words between rebuilds, and neighbouring days differ', () => {
    const a = planStudent(student()).filter((i) => i.kind === 'streak-daily')
    const b = planStudent(student()).filter((i) => i.kind === 'streak-daily')
    expect(a.map((i) => i.title)).toEqual(b.map((i) => i.title))
    const titles = a.map((i) => i.title)
    for (let k = 1; k < titles.length; k++) expect(titles[k]).not.toBe(titles[k - 1])
  })

  it('every reminder opens a page of the app', () => {
    for (const i of planStudent(student())) expect(i.url).toMatch(/^femata:\/\/go\?to=%2Fstudent/)
  })
})

describe('the teacher’s', () => {
  it('a heads-up before each lesson, and a note reminder after one with no note', () => {
    const at = new Date(2026, 2, 4, 15).getTime()
    const items = planTeacher({ role: 'teacher', now: NOW, on: {}, quiet: [], lessons: [
      { key: 'l1', at, minutes: 30, title: 'Kai Lee', noted: false },
      { key: 'l2', at: at + 3_600_000, minutes: 30, title: 'Mia', noted: true },
    ] })
    expect(items.find((i) => i.kind === 'teacher-lesson-soon')!.at).toBe(at - 15 * 60_000)
    const notes = items.filter((i) => i.kind === 'lesson-note-due')
    expect(notes).toHaveLength(1)
    expect(notes[0].at).toBe(at + 40 * 60_000)
    expect(notes[0].title).toMatch(/Kai/)
  })

  it('quiet students on Monday morning; the week’s summary on Sunday', () => {
    const items = planTeacher({ role: 'teacher', now: NOW, on: {}, quiet: ['Kai', 'Mia'], lessons: [] })
    expect(new Date(items.find((i) => i.kind === 'students-quiet')!.at).getDay()).toBe(1)
    expect(new Date(items.find((i) => i.kind === 'studio-week')!.at).getDay()).toBe(0)
  })
})

describe('the words', () => {
  it('every wording of every kind fills in when its fields are known', () => {
    const vars = { name: 'Ana', streak: 5, next: 6, left: 10, piece: 'Minuet', days: 3, performance: 'Recital', month: 'March', instrument: 'piano', teacher: 'Chen', title: 'Scales', when: 'today', note: 'Slower', time: '4 PM', preview: 'Hi', studio: 'Chen Music', rival: 'Ben', rank: 4, student: 'Kai', minutes: 30, count: 2 }
    for (const kind of Object.keys(COPY)) {
      for (let seed = 0; seed < COPY[kind].lines.length; seed++) {
        const c = compose(kind, vars, [], seed)!
        expect(c.title).not.toMatch(/[{}]/)
        expect(c.body).not.toMatch(/[{}]/)
      }
    }
  })

  it('a wording whose fields are missing is skipped, not shown half-filled', () => {
    for (let seed = 0; seed < 10; seed++) {
      const c = compose('streak-daily', { name: 'Ana' }, [], seed)!
      expect(c.title + c.body).not.toMatch(/\{|undefined/)
    }
  })

  it('the last few wordings of a kind are not repeated', () => {
    for (let n = 0; n < 20; n++) expect([0, 1, 2]).not.toContain(compose('streak-daily', { name: 'Ana', streak: 3, next: 4, piece: 'Minuet' }, [0, 1, 2])!.index)
  })
})
