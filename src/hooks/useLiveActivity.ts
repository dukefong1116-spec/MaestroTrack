import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStreak } from '@/hooks/useStreak'
import { usePracticeStore } from '@/stores/practiceStore'
import { useCategoryTimer } from '@/stores/categoryTimerStore'
import { isNativeApp } from '@/lib/native'
import { liveCleared, livePiece, liveShow, takeLiveActions } from '@/lib/nativeWidgets'

/**
 * The practice session on the Lock Screen and in the Dynamic Island,
 * following the practice timer wherever it is started or paused. Pause and
 * Resume pressed on the Live Activity are caught up on when the app is
 * back in front.
 */
export function useLiveActivity(enabled: boolean) {
  const { profile } = useAuth()
  const running = usePracticeStore((s) => s.timerRunning)
  const startedAt = usePracticeStore((s) => s.timerStartedAt)
  const banked = usePracticeStore((s) => s.timerAccumulatedSec)
  const category = useCategoryTimer((s) => s.current)
  const todayMinutes = useStreak().todayMinutes
  const goal = Math.round((profile?.weeklyGoalMinutes ?? 300) / 7)
  const on = enabled && isNativeApp

  useEffect(() => {
    if (!on) return
    const active = running || banked > 0
    if (!active) { liveCleared(); return }
    liveShow({
      startedAt: running && startedAt ? startedAt - banked * 1000 : Date.now() - banked * 1000,
      ...(running ? {} : { pausedElapsed: banked }),
      category: category ?? '',
      piece: livePiece(),
      todayMinutesBefore: Math.round(todayMinutes),
      goalMinutes: goal,
    })
  }, [on, running, startedAt, banked, category, todayMinutes, goal])

  // Pause / Resume pressed on the Live Activity while the app was away.
  useEffect(() => {
    if (!on) return
    const catchUp = async () => {
      if (document.visibilityState !== 'visible') return
      for (const action of await takeLiveActions()) {
        const t = usePracticeStore.getState()
        if (action === 'pause' && t.timerRunning) t.pauseTimer()
        if (action === 'resume' && !t.timerRunning && t.timerAccumulatedSec > 0) t.startTimer()
      }
    }
    void catchUp()
    document.addEventListener('visibilitychange', catchUp)
    return () => document.removeEventListener('visibilitychange', catchUp)
  }, [on])
}
