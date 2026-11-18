import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { currentRules, localDay } from '@/lib/streak/plan'
import { saveRuleChoice } from '@/lib/streak/save'

/**
 * A student in a studio has the streak's lesson day their teacher's
 * calendar says: when the teacher books or moves the weekly lesson, the
 * day follows. Like any rule change it starts tomorrow, so a streak is
 * never rewritten backwards.
 *
 * Only ever sets a day, never clears one: before every lesson has loaded
 * "no weekly lesson" looks the same as "not loaded yet", and a cleared day
 * could break a streak someone was relying on.
 */
export function useLessonDaySync() {
  const { profile } = useAuth()
  const lessons = usePracticeStore((s) => s.lessons)
  const teacherId = profile?.role === 'student' ? profile.teacherId : undefined
  const rules = profile?.streakRules

  useEffect(() => {
    if (!teacherId) return
    // Weekly lessons from the current teacher; the earliest-booked if several.
    const weekly = lessons
      .filter((l) => !l.date && l.teacherId === teacherId)
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))[0]
    if (!weekly) return
    const day = (weekly.dayOfWeek + 6) % 7 // Sunday = 0 there, Monday = 0 here
    const { now, next } = currentRules(rules, localDay())
    const target = next ?? now
    if (target.lessonDay === day) return
    void saveRuleChoice({ min: target.min, lessonDay: day }).catch(() => {})
  }, [teacherId, lessons, rules])
}
