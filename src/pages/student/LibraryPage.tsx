import { Navigate, useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import { Panel } from '@/components/ui/Panel'
import PiecesPanel from './panels/PiecesPanel'
import PerformancesPanel from './panels/PerformancesPanel'

const TABS: { id: string; label: string }[] = [
  { id: 'pieces', label: 'Pieces' },
  { id: 'performances', label: 'Performances' },
]

/**
 * Your repertoire and the things you're preparing it for. Tab lives in the
 * URL so it survives a refresh and the back button behaves.
 *
 * The switch is the same pill pair as Sessions | Progress on Practice.
 *
 * Assignments moved to the Studio page, which only a student in a studio
 * has; an old link to the tab here goes there.
 */
export default function LibraryPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  if (raw === 'assignments') return <Navigate to="/student/studio" replace />
  const tab = raw === 'performances' ? raw : 'pieces'

  return (
    <div>
      <PageHeader title="Library" />

      {/* The same pill switch as Sessions | Progress on Practice. */}
      <div className="mb-5 flex p-1" style={{ background: 'var(--clay-bg-deep)', borderRadius: 999 }} role="tablist">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setParams(t.id === 'pieces' ? {} : { tab: t.id }, { replace: true })}
              className="flex-1 py-2 text-center text-[13px] font-semibold transition-colors"
              style={{
                borderRadius: 999,
                background: active ? 'var(--clay-surface)' : 'transparent',
                color: active ? 'var(--clay-ink)' : 'var(--clay-dim)',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <Panel>
        {tab === 'pieces' && <PiecesPanel />}
        {tab === 'performances' && <PerformancesPanel />}
      </Panel>
    </div>
  )
}
