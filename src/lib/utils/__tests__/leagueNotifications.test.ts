import { describe, expect, it } from 'vitest'
import { leagueNotifications, applyNotifyPrefs, buildStudentNotifications } from '../notifications'
import type { LeagueRoom } from '@/types'

const NOW = new Date('2026-11-12T12:00:00.000Z')
const m = (name: string, xp: number, extra = {}) => ({ name, colour: 0, xp, xpAt: '2026-11-10T00:00:00.000Z', joinedAt: '', ...extra })

function room(over: Partial<LeagueRoom> = {}): LeagueRoom {
  return {
    id: 'r1', week: '2026-W46', weekStart: '2026-11-09', tier: 2, band: 0,
    endsAt: Date.parse('2026-11-16T00:00:00Z'), status: 'open',
    members: {
      ana: m('Ana R.', 90), ben: m('Ben K.', 80), me: m('Sam O.', 70),
      dan: m('Dan P.', 60), eve: m('Eve S.', 10),
    },
    ...over,
  }
}

describe('league bell items', () => {
  it('says who passed you, once a day', () => {
    const r = room()
    r.members.me = m('Sam O.', 70, { passedBy: { name: 'Ben K.', at: '2026-11-12T09:00:00.000Z' } })
    const items = leagueNotifications({ uid: 'me', room: r }, NOW)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: 'league-passed', title: 'Ben K. passed you', to: '/student/league' })
    expect(items[0].id).toBe('league:passed:r1:2026-11-12')
  })
  it('forgets an old pass', () => {
    const r = room()
    r.members.me = m('Sam O.', 70, { passedBy: { name: 'Ben K.', at: '2026-11-09T09:00:00.000Z' } })
    expect(leagueNotifications({ uid: 'me', room: r }, NOW)).toHaveLength(0)
  })
  it('on the last day, says you are one place from moving up', () => {
    const sunday = new Date('2026-11-15T12:00:00.000Z')
    const items = leagueNotifications({ uid: 'me', room: room() }, sunday)
    expect(items.map((i) => i.title)).toEqual(['Last day: 1 place from moving up'])
  })
  it('on the last day, warns about the drop zone', () => {
    const sunday = new Date('2026-11-15T12:00:00.000Z')
    const items = leagueNotifications({ uid: 'eve', room: room() }, sunday)
    expect(items[0].title).toBe("Last day: you're in the drop zone")
  })
  it('says nothing about the last day before it', () => {
    expect(leagueNotifications({ uid: 'me', room: room() }, NOW)).toHaveLength(0)
  })
  it('announces results until they are seen', () => {
    const result = { week: '2026-W45', roomId: 'r0', fromTier: 1, toTier: 2, rank: 2, of: 9, xp: 300, maestro: false, at: '2026-11-09T08:00:00.000Z' }
    expect(leagueNotifications({ uid: 'me', room: null, result }, NOW)[0]).toMatchObject({ kind: 'league-results' })
    expect(leagueNotifications({ uid: 'me', room: null, result, seenWeek: '2026-W45' }, NOW)).toHaveLength(0)
  })
  it('a finished room says nothing', () => {
    expect(leagueNotifications({ uid: 'me', room: room({ status: 'final' }) }, new Date('2026-11-15T12:00:00Z'))).toHaveLength(0)
  })
  it('the League switch in Settings turns all three off', () => {
    const result = { week: '2026-W45', roomId: 'r0', fromTier: 1, toTier: 2, rank: 2, of: 9, xp: 300, maestro: false, at: '2026-11-09T08:00:00.000Z' }
    const items = leagueNotifications({ uid: 'me', room: null, result }, NOW)
    expect(applyNotifyPrefs(items, { league: false })).toHaveLength(0)
  })
})

describe("you've joined", () => {
  const joined = { teacherId: 't1', at: '2026-11-11T09:00:00.000Z', studioName: 'Harper Strings' }
  it('says who let you in, and where', () => {
    const items = buildStudentNotifications({ assignments: [], lessons: [], joined, teacherName: 'Ms Harper', options: { now: NOW } })
    expect(items[0]).toMatchObject({ kind: 'studio-joined', title: "You've joined Harper Strings", body: 'Ms Harper accepted your request.', to: '/student/studio' })
  })
  it('is not switched off by any Settings category', () => {
    const items = buildStudentNotifications({ assignments: [], lessons: [], joined, options: { now: NOW } })
    const off = { assignments: false, feedback: false, lessons: false, league: false, submissions: false }
    expect(applyNotifyPrefs(items, off)).toHaveLength(1)
  })
  it('fades after a month', () => {
    const later = new Date('2027-01-20T12:00:00.000Z')
    expect(buildStudentNotifications({ assignments: [], lessons: [], joined, options: { now: later } })).toHaveLength(0)
  })
})
