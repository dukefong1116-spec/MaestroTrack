import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import PageHeader from '@/components/common/PageHeader'
import Sticker, { type StickerName } from '@/components/stickers/Sticker'
import PiecesPanel from './panels/PiecesPanel'
import PerformancesPanel from './panels/PerformancesPanel'
import AssignmentsPanel from './panels/AssignmentsPanel'

const TABS: { id: string; label: string; sticker: StickerName }[] = [
  { id: 'pieces', label: 'Pieces', sticker: 'book' },
  { id: 'performances', label: 'Performances', sticker: 'trophy' },
  { id: 'assignments', label: 'Assignments', sticker: 'clipboard' },
]

/**
 * Your repertoire and the things you're preparing it for. Tab lives in the
 * URL so it survives a refresh and the back button behaves.
 */
export default function LibraryPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab = raw === 'performances' || raw === 'assignments' ? raw : 'pieces'

  return (
    <div>
      <PageHeader title="Library" subtitle="What you're working on, and what you're working toward." />

      {/* Equal thirds on a phone, where three auto-width pills ran off
          the edge; the original auto-width row from sm up. */}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:flex">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <motion.button
              key={t.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setParams(t.id === 'pieces' ? {} : { tab: t.id }, { replace: true })}
              className="flex min-h-[44px] items-center justify-center gap-2 px-2 text-[12px] font-semibold transition-colors sm:min-h-0 sm:px-4 sm:py-2.5 sm:text-sm"
              style={{
                borderRadius: 'var(--clay-r-sm)',
                background: active ? 'var(--clay-accent)' : 'var(--clay-surface)',
                color: active ? 'var(--clay-on-accent)' : 'var(--clay-dim)',
                boxShadow: active ? 'var(--clay-accent-shadow)' : 'var(--clay-raised)',
              }}
            >
              <Sticker name={t.sticker} size={16} tone={active ? 'onAccent' : 'ink'} className="hidden shrink-0 sm:block" />
              <span className="truncate">{t.label}</span>
            </motion.button>
          )
        })}
      </div>

      {tab === 'pieces' && <PiecesPanel />}
      {tab === 'performances' && <PerformancesPanel />}
      {tab === 'assignments' && <AssignmentsPanel />}
    </div>
  )
}
