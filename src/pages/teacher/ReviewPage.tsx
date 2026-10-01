import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import Card from '@/components/ui/Card'
import Sticker from '@/components/stickers/Sticker'
import ReviewSheet from '@/components/assignments/ReviewSheet'
import { useReviewQueue, type ReviewItem } from '@/hooks/useReviewQueue'
import { subscribeRecordings } from '@/lib/firebase/recordings'
import { dueLabel } from '@/lib/utils/assignments'
import type { Recording } from '@/types'

/**
 * Work handed in, oldest first, across every student.
 *
 * Assignments were previously only visible one student at a time, so a
 * teacher learned that work had arrived by opening each student and
 * noticing. Past about three students that stops happening, submissions go
 * unanswered, and students learn that handing things in achieves nothing.
 */
export default function ReviewPage() {
  const { queue, overdue } = useReviewQueue()
  const [reviewing, setReviewing] = useState<ReviewItem | null>(null)
  const [recordings, setRecordings] = useState<Recording[]>([])

  // Only the student whose work is open, and only while it is open: a
  // teacher has no business holding every student's audio in memory.
  useEffect(() => {
    const studentId = reviewing?.assignment.studentId
    if (!studentId) { setRecordings([]); return }
    return subscribeRecordings(studentId, setRecordings)
  }, [reviewing?.assignment.studentId])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[27px] font-semibold leading-tight" style={{ color: 'var(--clay-ink)' }}>
          Review
        </h1>
        <p className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>
          {queue.length === 0 ? 'Nothing waiting on you.' : `${queue.length} waiting on you`}
        </p>
      </div>

      {queue.length === 0 ? (
        <Card className="p-8 text-center">
          <Sticker name="check" size={32} tone="accent" />
          <p className="mt-3 text-[13px]" style={{ color: 'var(--clay-dim)' }}>
            You're all caught up.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {queue.map((item, i) => (
            <motion.button
              key={item.assignment.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setReviewing(item)}
              className="w-full text-left"
            >
              <Card className="flex items-center gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ background: 'var(--clay-accent-soft)' }}>
                  <Sticker name="clipboard" size={17} tone="accent" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
                    {item.assignment.title}
                  </span>
                  <span className="block text-[12px]" style={{ color: 'var(--clay-dim)' }}>
                    {item.student?.displayName ?? 'Student'}
                    {item.submittedAt && ` · handed in ${format(parseISO(item.submittedAt), 'MMM d')}`}
                  </span>
                </span>
                {(item.assignment.submissions?.length ?? 0) > 1 && (
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                        style={{ background: 'var(--clay-bg-deep)', color: 'var(--clay-dim)' }}>
                    attempt {item.assignment.submissions!.length}
                  </span>
                )}
              </Card>
            </motion.button>
          ))}
        </div>
      )}

      {/* Nobody is waiting on these, but they have gone past their date. */}
      {overdue.length > 0 && (
        <section>
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
            Overdue, not handed in ({overdue.length})
          </p>
          <div className="space-y-2">
            {overdue.map((a) => (
              <Card key={a.id} className="flex items-center gap-3 p-3.5">
                <Sticker name="clock" size={15} tone="ink" />
                <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: 'var(--clay-ink)' }}>
                  {a.title}
                </span>
                <span className="shrink-0 text-[11px]" style={{ color: 'var(--clay-danger)' }}>
                  {dueLabel(a)}
                </span>
              </Card>
            ))}
          </div>
        </section>
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
