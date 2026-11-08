import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Sticker from '@/components/stickers/Sticker'
import AssignmentCard from '@/components/assignments/AssignmentCard'
import SubmitSheet from '@/components/assignments/SubmitSheet'
import { Block } from '@/components/ui/Panel'
import { useAssignments } from '@/hooks/useAssignments'
import { awaitingStudent, normaliseStatus } from '@/lib/utils/assignments'
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
  const [params, setParams] = useSearchParams()

  /**
   * Opened straight from a notification.
   *
   * The bell sends you to ?tab=assignments&open=<id>; this finds that one
   * and opens it. The parameter is stripped once it has been acted on, so
   * closing the sheet does not immediately reopen it on the next render,
   * and a reload does not drag you back in.
   *
   * Waits for the assignment to exist: the list arrives from a
   * subscription, so on a cold load the id is in the URL before there is
   * anything to match it against.
   */
  const wanted = params.get('open')
  useEffect(() => {
    if (!wanted) return
    const all = [...todo, ...open, ...done]
    const found = all.find((x) => x.assignment.id === wanted)
    if (!found) return
    setSubmitting(found.assignment)
    const next = new URLSearchParams(params)
    next.delete('open')
    setParams(next, { replace: true })
  }, [wanted, todo, open, done, params, setParams])

  const waiting = open.filter((x) => !awaitingStudent(x.assignment))

  if (open.length === 0 && done.length === 0) {
    return (
      <div
        className="rounded-[var(--clay-r-md)] px-5 py-12 text-center"
        style={{ background: 'var(--clay-surface)' }}
      >
        {/* text-center does not move a block-level sticker. */}
        <div className="flex justify-center" style={{ opacity: 0.55 }}>
          <Sticker name="clipboard" size={34} tone="ink" />
        </div>
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
    <Block first>
      <div className="space-y-6">
      {todo.length > 0 && (
        <section>
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
            To do ({todo.length})
          </p>
          <div className="space-y-2.5">
            {todo.map((x) => (
              <AssignmentCard
                key={x.assignment.id}
                assignment={x.assignment}
                progress={x.progress}
                daily={x.daily}
                due={x.due}
                onOpen={() => setSubmitting(x.assignment)}
                actionLabel={normaliseStatus(x.assignment.status) === 'returned' ? 'Try again' : 'Hand in'}
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
            {waiting.map((x) => (
              <AssignmentCard key={x.assignment.id} assignment={x.assignment}
                              progress={x.progress} daily={x.daily} due={x.due}
                              onOpen={() => setSubmitting(x.assignment)} />
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
            {done.slice(0, 20).map((x) => (
              <AssignmentCard key={x.assignment.id} assignment={x.assignment}
                              progress={x.progress} daily={x.daily} due={x.due}
                              onOpen={() => setSubmitting(x.assignment)} />
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
    </Block>
  )
}
