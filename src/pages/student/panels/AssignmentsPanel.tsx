import { useState } from 'react'
import Sticker from '@/components/stickers/Sticker'
import AssignmentCard from '@/components/assignments/AssignmentCard'
import SubmitSheet from '@/components/assignments/SubmitSheet'
import { useAssignments } from '@/hooks/useAssignments'
import { awaitingStudent } from '@/lib/utils/assignments'
import type { Assignment } from '@/types'

/**
 * Everything a student's teacher has set them.
 *
 * Separate from the dashboard's existing summary, which stays as it is:
 * that shows what is due now, this shows the whole picture including work
 * already approved — which is the part worth looking back at.
 */
export default function AssignmentsPanel() {
  const { todo, open, done } = useAssignments()
  const [submitting, setSubmitting] = useState<Assignment | null>(null)

  const waiting = open.filter((x) => !awaitingStudent(x.assignment))

  if (open.length === 0 && done.length === 0) {
    return (
      <div className="py-10 text-center">
        <Sticker name="clipboard" size={34} tone="ink" />
        <p className="mt-3 text-[13px]" style={{ color: 'var(--clay-dim)' }}>
          Nothing set right now.
        </p>
        <p className="mt-1 text-[12px]" style={{ color: 'var(--clay-faint)' }}>
          Work your teacher assigns will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {todo.length > 0 && (
        <section>
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
            To do ({todo.length})
          </p>
          <div className="space-y-2.5">
            {todo.map((x, i) => (
              <AssignmentCard
                key={x.assignment.id}
                assignment={x.assignment}
                progress={x.progress}
                due={x.due}
                index={i}
                onAction={() => setSubmitting(x.assignment)}
              />
            ))}
          </div>
        </section>
      )}

      {waiting.length > 0 && (
        <section>
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
            Handed in
          </p>
          <div className="space-y-2.5">
            {waiting.map((x, i) => (
              <AssignmentCard key={x.assignment.id} assignment={x.assignment}
                              progress={x.progress} due={x.due} index={i} />
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
            Done
          </p>
          <div className="space-y-2.5">
            {done.slice(0, 20).map((x, i) => (
              <AssignmentCard key={x.assignment.id} assignment={x.assignment}
                              progress={x.progress} due={x.due} index={i} />
            ))}
          </div>
        </section>
      )}

      <SubmitSheet
        assignment={submitting}
        open={!!submitting}
        onClose={() => setSubmitting(null)}
      />
    </div>
  )
}
