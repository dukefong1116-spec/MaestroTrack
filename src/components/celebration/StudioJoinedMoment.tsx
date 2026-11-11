import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Moment from './Moment'
import Confetti from './Confetti'
import Sticker from '@/components/stickers/Sticker'
import { useAuth } from '@/hooks/useAuth'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { playBadgeFanfare } from '@/lib/utils/sound'

const SEEN = (uid: string) => `maestro_joined_seen_${uid}`

/**
 * "You're in": the moment a teacher accepts you, if the app is open — or
 * the next time you open it, if it was not.
 *
 * Accepting is the teacher writing your teacherId, which reaches you
 * through your live profile. So this watches for a teacher appearing
 * where there was none, and only then: someone opening the app on a new
 * device already in a studio sees nothing, since there was no "before".
 * The bell keeps a lasting note of it (see buildStudentNotifications).
 * Shown once per teacher on this device.
 */
export default function StudioJoinedMoment() {
  const { profile, profileLive } = useAuth()
  const reduced = usePrefersReducedMotion()
  const isStudent = profile?.role === 'student'
  const uid = profile?.uid
  const teacherId = isStudent ? profile?.teacherId ?? '' : ''

  // The first teacherId seen this visit — from the copy saved on the
  // device, or the server's if none was saved.
  const before = useRef<{ uid: string; teacherId: string } | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!uid || !isStudent) return
    if (!before.current || before.current.uid !== uid) {
      before.current = { uid, teacherId }
      return
    }
    if (!profileLive || !teacherId || before.current.teacherId) {
      before.current.teacherId = teacherId
      return
    }
    before.current.teacherId = teacherId
    try {
      if (localStorage.getItem(SEEN(uid)) === teacherId) return
      localStorage.setItem(SEEN(uid), teacherId)
    } catch { /* shown regardless */ }
    setOpen(true)
  }, [uid, isStudent, teacherId, profileLive])

  useEffect(() => { if (open) playBadgeFanfare() }, [open])

  const studio = profile?.studioName
  const teacher = profile?.teacherName

  return (
    <Moment open={open} onDismiss={() => setOpen(false)} autoDismissMs={5200}>
      {open && !reduced && <Confetti colors={[]} />}
      <div
        className="relative px-8 py-10 text-center"
        style={{ background: 'var(--clay-surface)', borderRadius: 'var(--clay-r-lg)', boxShadow: 'var(--clay-deep)' }}
      >
        <motion.div
          className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl"
          style={{ background: 'linear-gradient(135deg,var(--clay-accent),var(--clay-accent-hover))' }}
          initial={reduced ? false : { scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 15, delay: 0.15 }}
        >
          <Sticker name="users" size={40} tone="onAccent" />
        </motion.div>
        <motion.h2
          className="text-[26px] font-bold leading-tight"
          style={{ color: 'var(--clay-ink)' }}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          You're in!
        </motion.h2>
        <motion.p
          className="mt-2 text-[15px]"
          style={{ color: 'var(--clay-dim)', textWrap: 'balance' } as React.CSSProperties}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          {teacher ? `${teacher} accepted you` : 'Your teacher accepted you'}
          {studio ? ` into ${studio}.` : '.'} Assignments and messages from your teacher will show up here.
        </motion.p>
      </div>
    </Moment>
  )
}
