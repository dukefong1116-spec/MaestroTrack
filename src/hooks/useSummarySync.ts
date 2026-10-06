import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { buildSummaries } from '@/lib/utils/summary'
import { writeSummaries } from '@/lib/firebase/summary'

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
  const { profile } = useAuth()
  const sessions = usePracticeStore((s) => s.sessions)
  const loading = usePracticeStore((s) => s.sessions.length)
  const lastWritten = useRef<string>('')

  useEffect(() => {
    if (!profile?.uid || profile.role !== 'student') return
    // Nothing loaded yet — writing now would publish an empty summary over
    // a good one.
    if (loading === 0) return

    const { studio, summary } = buildSummaries(sessions, {
      uid: profile.uid,
      displayName: profile.displayName,
      instrument: profile.instrument,
      teacherId: profile.teacherId,
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
    })
    if (fingerprint === lastWritten.current) return
    lastWritten.current = fingerprint

    void writeSummaries(studio, summary).catch(() => {
      // A failed write just means the summary is stale until the next
      // change; practice itself is already saved and is the real record.
      lastWritten.current = ''
    })
  }, [profile?.uid, profile?.role, profile?.displayName, profile?.instrument,
      profile?.teacherId, sessions, loading])
}
