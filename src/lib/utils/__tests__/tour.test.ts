import { describe, expect, it } from 'vitest'
import { whatToShow, type TourInput, type Decision } from '../tour'

const base: TourInput = { tour: 'welcome', seen: [], path: '/student', sub: null, hasPieces: false, firstName: 'Sam' }
const at = (over: Partial<TourInput>) => whatToShow({ ...base, ...over })
const id = (d: Decision) => (d.kind === 'show' ? d.show.id : d.kind)

describe('who is shown anything at all', () => {
  it('an account from before the tour sees nothing, anywhere', () => {
    for (const path of ['/student', '/student/library', '/student/progress', '/student/session']) {
      expect(at({ tour: undefined, path, hasPieces: true })).toEqual({ kind: 'none' })
    }
  })
})

describe('the first-run tour, in order', () => {
  it('greets them by name on Today', () => {
    const d = at({})
    expect(id(d)).toBe('welcome')
    if (d.kind === 'show') expect(d.show.title).toContain('Hi Sam!')
  })

  it('walks Today, then makes them tap Start', () => {
    expect(id(at({ tour: 'today' }))).toBe('today')
    const start = at({ tour: 'start' })
    expect(id(start)).toBe('start')
    if (start.kind === 'show') expect(start.show).toMatchObject({ mustTap: true, block: true, target: 'start-practising' })
  })

  it('inside the session: category, then tools, then Finish', () => {
    const session = { tour: 'start' as const, path: '/student/session' }
    expect(id(at({ ...session, sub: null }))).toBe('category') // fresh session starts here
    expect(id(at({ ...session, sub: 'category' }))).toBe('category')
    expect(id(at({ ...session, sub: 'tools' }))).toBe('tools')
    const finish = at({ ...session, sub: 'finish' })
    expect(id(finish)).toBe('finish')
    // Free to practise while waiting for Finish.
    if (finish.kind === 'show') expect(finish.show.block).toBe(false)
  })

  it('steps aside while the finish sheet and celebration run', () => {
    expect(at({ tour: 'start', path: '/student/session', sub: 'saving' })).toEqual({ kind: 'none' })
    expect(at({ tour: 'streak', path: '/student/session' })).toEqual({ kind: 'none' })
  })

  it('then the streak on Today, then a tap on Practice', () => {
    expect(id(at({ tour: 'streak' }))).toBe('streak')
    const history = at({ tour: 'history' })
    expect(id(history)).toBe('history')
    if (history.kind === 'show') expect(history.show).toMatchObject({ mustTap: true, target: 'tab-practice' })
  })

  it('sends them back to Today from anywhere else mid-tour', () => {
    for (const tour of ['welcome', 'today', 'start', 'streak', 'history'] as const) {
      expect(at({ tour, path: '/student/library' })).toEqual({ kind: 'redirect', to: '/student' })
    }
  })

  it('leaves the invite page alone, so a new student can finish joining', () => {
    expect(at({ path: '/join/abc123' })).toEqual({ kind: 'none' })
    expect(at({ tour: 'start', path: '/login' })).toEqual({ kind: 'none' })
  })

  it('numbers every step of the tour for its dots, and no intro', () => {
    const steps = [
      at({}), at({ tour: 'today' }), at({ tour: 'start' }),
      at({ tour: 'start', path: '/student/session', sub: 'category' }),
      at({ tour: 'start', path: '/student/session', sub: 'tools' }),
      at({ tour: 'start', path: '/student/session', sub: 'finish' }),
      at({ tour: 'streak' }), at({ tour: 'history' }),
    ]
    expect(steps.map((d) => (d.kind === 'show' ? d.show.progress : null)))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [n, 8]))
    const intro = at({ tour: 'done', path: '/student/library' })
    if (intro.kind === 'show') expect(intro.show.progress).toBeUndefined()
  })

  it('a trailing slash is still Today', () => {
    expect(id(at({ path: '/student/' }))).toBe('welcome')
  })
})

describe('after the tour', () => {
  const done = { tour: 'done' as const }

  it('introduces the Library and Progress once each', () => {
    expect(id(at({ ...done, path: '/student/library' }))).toBe('intro-library')
    expect(id(at({ ...done, path: '/student/library', seen: ['library'] }))).toBe('none')
    expect(id(at({ ...done, path: '/student/practice/progress' }))).toBe('intro-progress')
    expect(id(at({ ...done, path: '/student/practice/progress', seen: ['progress'] }))).toBe('none')
  })

  it('asks for a piece in a session only once there is one to pick', () => {
    expect(id(at({ ...done, path: '/student/session', hasPieces: false }))).toBe('none')
    const prompt = at({ ...done, path: '/student/session', hasPieces: true })
    expect(id(prompt)).toBe('piece-prompt')
    if (prompt.kind === 'show') expect(prompt.show).toMatchObject({ mustTap: true, block: true })
    expect(id(at({ ...done, path: '/student/session', hasPieces: true, seen: ['piece-prompt'] }))).toBe('none')
  })

  it('leaves every other page alone, and never redirects', () => {
    for (const path of ['/student', '/student/practice', '/student/settings']) {
      expect(at({ ...done, path })).toEqual({ kind: 'none' })
    }
  })
})

describe('joining a studio', () => {
  const joined = { inStudio: true, studioName: 'Harper Strings', teacherName: 'Ms. Harper', compact: true }

  it('walks a phone through welcome, the moved Settings, then the Studio tab', () => {
    const welcome = at({ ...joined, tour: 'done' })
    expect(id(welcome)).toBe('studio-welcome')
    if (welcome.kind === 'show') expect(welcome.show.title).toContain('Harper Strings')
    const settings = at({ ...joined, tour: 'done', studioStep: 'settings' })
    expect(id(settings)).toBe('studio-settings')
    if (settings.kind === 'show') expect(settings.show.target).toBe('settings-photo')
    const tab = at({ ...joined, tour: 'done', studioStep: 'tab' })
    expect(id(tab)).toBe('studio-tab')
    if (tab.kind === 'show') expect(tab.show).toMatchObject({ mustTap: true, target: 'tab-studio' })
    expect(id(at({ ...joined, tour: 'done', path: '/student/studio' }))).toBe('studio-page')
  })

  it('skips the Settings step on a desktop, where Settings stays in the sidebar', () => {
    expect(id(at({ ...joined, compact: false, tour: 'done', studioStep: 'settings' }))).toBe('studio-tab')
  })

  it('reaches accounts from before the tour, since their bar changed too', () => {
    expect(id(at({ ...joined, tour: undefined }))).toBe('studio-welcome')
  })

  it('never interrupts a new account’s first-run tour', () => {
    expect(id(at({ ...joined, tour: 'welcome' }))).toBe('welcome')
    expect(id(at({ ...joined, tour: 'start', path: '/student/session' }))).toBe('category')
  })

  it('waits for Today rather than pulling anyone away mid-task', () => {
    expect(at({ ...joined, tour: 'done', path: '/student/library' })).toEqual({ kind: 'none' })
    expect(at({ ...joined, tour: 'done', path: '/student/session' })).toEqual({ kind: 'none' })
  })

  it('is shown once, and never to a solo musician', () => {
    expect(at({ ...joined, tour: 'done', seen: ['studio'] })).toEqual({ kind: 'none' })
    expect(at({ tour: 'done', inStudio: false })).toEqual({ kind: 'none' })
  })
})
