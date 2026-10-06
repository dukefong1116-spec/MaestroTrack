import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import Card from '@/components/ui/Card'
import Sticker from '@/components/stickers/Sticker'
import ReviewSheet from './ReviewSheet'
import { useReviewQueue, type ReviewItem } from '@/hooks/useReviewQueue'
import { subscribeSharedRecordings } from '@/lib/firebase/recordings'
import type { Recording } from '@/types'

/**
 * Work handed in, on the page a teacher already opens.
 *
 * This began as its own Review tab, which was the wrong shape: a queue you
 * have to remember to visit is a queue that goes unread, and when it is
 * empty — which is most of the time — the tab is dead weight in the
 * navigation. Reviewing belongs where a teacher already is, and it should
 * disappear entirely when there is nothing waiting.
 */
export default function SubmissionsWaiting() {
  const { queue } = useReviewQueue()
  const [reviewing, setReviewing] = useState<ReviewItem | null>(null)
  const [recordings, setRecordings] = useState<Recording[]>([])

  // Only the student under review, and only while their work is open.
  useEffect(() => {
    const studentId = reviewing?.assignment.studentId
    if (!studentId) { setRecordings([]); return }
    return subscribeSharedRecordings(studentId, setRecordings)
  }, [reviewing?.assignment.studentId])

  if (queue.length === 0) return null

  return (
    <div className="mb-8">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"
         style={{ color: 'var(--clay-dim)' }}>
        <Sticker name="clipboard" size={14} tone="accent" />
        {queue.length === 1 ? '1 submission waiting' : `${queue.length} submissions waiting`}
      </p>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {queue.slice(0, 5).map((item, i) => (
            <motion.button
              key={item.assignment.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setReviewing(item)}
              className="w-full text-left"
            >
              <Card className="flex items-center gap-3 p-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ background: 'var(--clay-accent)' }}>
                  <Sticker name="mic" size={15} tone="onAccent" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
                    {item.student?.displayName ?? 'Student'} handed in {item.assignment.title}
                  </span>
                  <span className="block text-[11.5px]" style={{ color: 'var(--clay-dim)' }}>
                    {item.submittedAt ? format(parseISO(item.submittedAt), 'MMM d') : ''}
                    {(item.assignment.submissions?.length ?? 0) > 1 &&
                      ` · attempt ${item.assignment.submissions!.length}`}
                  </span>
                </span>
                <span className="shrink-0 rounded-full px-3 py-1 text-[11.5px] font-semibold"
                      style={{ background: 'var(--clay-accent-soft)', color: 'var(--clay-accent-ink)' }}>
                  Review
                </span>
              </Card>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {queue.length > 5 && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--clay-faint)' }}>
          and {queue.length - 5} more
        </p>
      )}

      <ReviewSheet
        assignment={reviewing?.assignment ?? null}
        studentName={reviewing?.student?.displayName ?? 'Student'}
        recordings={recordings}
        open={!!reviewing}
        onClose={() => setReviewing(null)}
      />
    </div>
  )
}
