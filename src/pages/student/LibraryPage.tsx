import { Navigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import PageHeader from '@/components/common/PageHeader'
import Sticker, { type StickerName } from '@/components/stickers/Sticker'
import { Panel } from '@/components/ui/Panel'
import PiecesPanel from './panels/PiecesPanel'
import PerformancesPanel from './panels/PerformancesPanel'

const TABS: { id: string; label: string; sticker: StickerName }[] = [
  { id: 'pieces', label: 'Pieces', sticker: 'book' },
  { id: 'performances', label: 'Performances', sticker: 'trophy' },
]

/**
 * Your repertoire and the things you're preparing it for. Tab lives in the
 * URL so it survives a refresh and the back button behaves.
 *
 * The tabs are the top of the panel rather than pills floating above it:
 * they select what the panel shows, so they belong to it.
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
      <PageHeader title="Library" subtitle="What you're working on, and what you're working toward." />

      <Panel>
        <div className="grid grid-cols-2" style={{ borderBottom: '1px solid var(--clay-line)' }}>
          {TABS.map((t, i) => {
            const active = tab === t.id
            return (
              <motion.button
                key={t.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => setParams(t.id === 'pieces' ? {} : { tab: t.id }, { replace: true })}
                className="relative flex min-h-[48px] items-center justify-center gap-2 px-2 text-[12.5px] font-semibold transition-colors sm:text-sm"
                style={{
                  color: active ? 'var(--clay-accent-ink)' : 'var(--clay-dim)',
                  borderLeft: i === 0 ? undefined : '1px solid var(--clay-line)',
                }}
              >
                <Sticker name={t.sticker} size={16} tone="ink" className="hidden shrink-0 sm:block" />
                <span className="truncate">{t.label}</span>
                {/* An underline rather than a filled pill: the tab is part
                    of the panel, so it marks itself without detaching. */}
                {active && (
                  <span
                    className="absolute inset-x-0 bottom-0 h-[2.5px]"
                    style={{ background: 'var(--clay-accent)' }}
                  />
                )}
              </motion.button>
            )
          })}
        </div>

        {tab === 'pieces' && <PiecesPanel />}
        {tab === 'performances' && <PerformancesPanel />}
      </Panel>
    </div>
  )
}
