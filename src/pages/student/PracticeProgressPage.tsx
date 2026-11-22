import PracticeTabs from '@/components/practice/PracticeTabs'
import ProgressPage from './ProgressPage'

/**
 * Practice → Progress. The Progress page as it always was, under the
 * Practice heading, now that League has its old place in the tab bar.
 */
export default function PracticeProgressPage() {
  return (
    <div style={{ fontFamily: 'var(--clay-font)', color: 'var(--clay-ink)' }}>
      {/* Lined up with Sessions, which sits 4px further out and up (its own
          page padding), so the title does not jump between the two. The
          same height as Sessions' heading row, which has Log past in it. */}
      <div className="-mt-1 w-full max-w-md max-md:-mx-1 max-md:w-[calc(100%+8px)] md:mx-auto">
        <div className="mb-5 flex min-h-[39px] items-center">
          <h1 className="text-[27px] font-semibold leading-tight">Practice</h1>
        </div>
        <PracticeTabs />
      </div>
      <ProgressPage embedded />
    </div>
  )
}
