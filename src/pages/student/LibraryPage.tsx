import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import PageHeader from '@/components/common/PageHeader'
import Sticker, { type StickerName } from '@/components/stickers/Sticker'
import PiecesPanel from './panels/PiecesPanel'
import PerformancesPanel from './panels/PerformancesPanel'

const TABS: { id: string; label: string; sticker: StickerName }[] = [
  { id: 'pieces', label: 'Pieces', sticker: 'book' },
  { id: 'performances', label: 'Performances', sticker: 'trophy' },
]

/**
 * Your repertoire and the things you're preparing it for. Tab lives in the
 * URL so it survives a refresh and the back button behaves.
 */
export default function LibraryPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'performances' ? 'performances' : 'pieces'

  return (
    <div>
      <PageHeader title="Library" subtitle="What you're working on, and what you're working toward." />

      <div className="mb-6 flex gap-2">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <motion.button
              key={t.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setParams(t.id === 'pieces' ? {} : { tab: t.id }, { replace: true })}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors"
              style={{
                borderRadius: 'var(--clay-r-sm)',
                background: active ? 'var(--clay-accent)' : 'var(--clay-surface)',
                color: active ? 'var(--clay-on-accent)' : 'var(--clay-dim)',
                boxShadow: active ? 'var(--clay-accent-shadow)' : 'var(--clay-raised)',
              }}
            >
              <Sticker name={t.sticker} size={16} tone={active ? 'onAccent' : 'ink'} />
              {t.label}
            </motion.button>
          )
        })}
      </div>

      {tab === 'pieces' ? <PiecesPanel /> : <PerformancesPanel />}
    </div>
  )
}
