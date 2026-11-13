import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { buildSummaries } from '@/lib/utils/summary'
import { writeSummaries } from '@/lib/firebase/summary'

/**
 * Why the last write failed, if it did. Read by the teacher's empty state,
 * which otherwise cannot tell "this student has not practised" from "the
 * database refused to store the figures".
 */
let lastError: string | null = null
export function summaryWriteError(): string | null {
  return lastError
}

/**
 * Keeps a student's rolled-up practice up to date.
 *
 * Runs on the student's own device because there is no server yet. That
 * makes the figures self-reported — a modified client could inflate them —
 * which is a fair trade for classmates comparing practice minutes, and
 * stops being true the moment this moves to a Cloud Function, with no
 * change to anything that reads it.
 *
 * It also backfills: a student who has practised for months but never had
 * a summary gets one on their next visit, so nothing looks empty to their
 * teacher while they wait for the next session to be logged.
 */
export function useSummarySync() {
  const { profile, profileLive } = useAuth()
  const sessions = usePracticeStore((s) => s.sessions)
  const sessionsLoaded = usePracticeStore((s) => s.sessionsLoaded)
  const lastWritten = useRef<string>('')
  const lastUid = useRef<string>('')
  const writeQueue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (!profile?.uid || profile.role !== 'student') return
    // Not from the copy saved on this device: its streak rules may be old.
    if (!profileLive) return
    if (lastUid.current !== profile.uid) {
      lastUid.current = profile.uid
      // What this device last wrote successfully, remembered across opens:
      // without it every open rewrote an unchanged summary, competing with
      // the live data for the connection just as the app was starting.
      lastWritten.current = readWritten(profile.uid)
    }
    // Nothing loaded yet — writing now would publish an empty summary over
    // a good one.
    if (!sessionsLoaded) return

    const { studio, summary } = buildSummaries(sessions, {
      uid: profile.uid,
      displayName: profile.displayName,
      instrument: profile.instrument,
      teacherId: profile.teacherId,
      streakRules: profile.streakRules,
      streakFreezesUsed: profile.streakFreezesUsed,
      streakRepaired: profile.streakRepaired,
    })

    // Only write when the figures actually changed. Session subscriptions
    // fire on every snapshot, and rewriting an identical summary each time
    // would be a write per snapshot for no benefit.
    const fingerprint = JSON.stringify({
      d: studio.dailyMinutes,
      c: summary.dailyCategories,
      s: studio.currentStreak,
      n: studio.displayName,
      t: studio.teacherId,
      r: summary.recentSessions?.map((x) => `${x.id}:${x.minutes}`),
    })
    if (fingerprint === lastWritten.current) return
    lastWritten.current = fingerprint

    writeQueue.current = writeQueue.current.catch(() => {}).then(() => writeSummaries(studio, summary))
    const uid = profile.uid
    void writeQueue.current
      .then(() => { lastError = null; saveWritten(uid, fingerprint) })
      .catch((err: { code?: string }) => {
        // Swallowing this was wrong. A denied write means a teacher sees an
        // empty page and neither of us can tell why — practice is still
        // safely recorded, but the rolled-up copy silently never appears.
        lastError = err?.code ?? 'unknown'
        console.warn(
          '[summary] could not save the rolled-up practice figures:', lastError,
          '— if this is permission-denied, the practiceSummary and studioStats',
          'rules have not been published yet.'
        )
        lastWritten.current = ''
        saveWritten(uid, '')
      })
  }, [profile?.uid, profile?.role, profile?.displayName, profile?.instrument,
      profile?.teacherId, profile?.streakRules, profile?.streakFreezesUsed,
      profile?.streakRepaired, sessions, sessionsLoaded, profileLive])
}

const WRITTEN = (uid: string) => `maestro_summary_written_${uid}`
function readWritten(uid: string): string {
  try { return localStorage.getItem(WRITTEN(uid)) ?? '' } catch { return '' }
}
function saveWritten(uid: string, fingerprint: string) {
  try { localStorage.setItem(WRITTEN(uid), fingerprint) } catch { /* unavailable: it just writes again */ }
}
