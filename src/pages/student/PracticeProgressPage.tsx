import { format } from 'date-fns'
import PracticeTabs from '@/components/practice/PracticeTabs'
import ProgressPage from './ProgressPage'

/**
 * Practice → Progress. The Progress page as it always was, under the
 * Practice heading, now that League has its old place in the tab bar.
 */
export default function PracticeProgressPage() {
  return (
    <div style={{ fontFamily: 'var(--clay-font)', color: 'var(--clay-ink)' }}>
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5">
          <h1 className="text-[27px] font-semibold leading-tight">Practice</h1>
          <p className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>
            {format(new Date(), 'EEEE')} · how you're doing
          </p>
        </div>
        <PracticeTabs />
      </div>
      <ProgressPage embedded />
    </div>
  )
}
