import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { addPieceForStudent, deletePiece, subscribeSharedPieces } from '@/lib/firebase/pieces'
import type { Piece } from '@/types'
import { haptic } from '@/lib/haptics'
import { X } from 'lucide-react'
import { updateRosterStudent } from '@/lib/firebase/studio'
import type { Member } from '@/hooks/useStudioData'
import { Btn, Empty } from '@/components/teacher/studio/ui'
import AddFab from '@/components/teacher/studio/AddFab'
import { inputCls, inputStyle, toneColors } from '@/components/teacher/studio/tokens'
import type { RepertoireItem, RepertoireStatus } from '@/types'
import { REP_STATUS } from '@/lib/studio/labels'

/** What they are working on: pieces and skills, how far along, the tempo goal and the next step. */
export default function Repertoire({ m }: { m: Member }) {
  const items = m.roster.repertoire ?? []
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<'piece' | 'skill'>('piece')
  // The form opens from the + (as on the calendar), not always on show.
  const [adding, setAdding] = useState(false)
  const { profile } = useAuth()

  // Their Library, live: the pieces they share with you and the ones you
  // gave them. Only for a student on the app who is in your studio.
  const linked = !!m.uid && m.profile?.teacherId === profile?.uid
  const [library, setLibrary] = useState<Piece[] | null>(null)
  useEffect(() => {
    if (!linked || !m.uid) { setLibrary(null); return }
    return subscribeSharedPieces(m.uid, setLibrary)
  }, [linked, m.uid])
  const save = (next: RepertoireItem[]) => updateRosterStudent(m.id, { repertoire: next })
  const patch = (id: string, p: Partial<RepertoireItem>) => save(items.map((x) => {
    if (x.id !== id) return x
    const status = p.status && p.status !== x.status ? p.status : null
    return { ...x, ...p, history: status ? [...x.history, { at: new Date().toISOString(), status }] : x.history }
  }))
  function add() {
    if (!title.trim()) return
    // A piece goes into their own Library, where they practise it and get
    // told it arrived; a skill (or a student not on the app) stays here.
    if (kind === 'piece' && linked && m.uid) {
      void addPieceForStudent(m.uid, profile?.displayName ?? '', title.trim().slice(0, 120)).then(() => haptic('success'))
      setTitle('')
      setAdding(false)
      return
    }
    void save([...items, { id: Date.now().toString(36), title: title.trim().slice(0, 120), kind, status: 'learning', history: [{ at: new Date().toISOString(), status: 'learning' }] }])
    setTitle('')
    setAdding(false)
  }

  return (
    <div>
      <AddFab id="repertoire-add" label="Add a piece or skill" visible={!adding} onAdd={() => setAdding(true)} />
      {adding && <div className="flex flex-wrap items-center gap-2 px-5 py-3 sm:px-6" style={{ borderBottom: '1px solid var(--clay-line)' }}>
        <input autoFocus aria-label="New piece or skill" className={`${inputCls} min-w-[200px] flex-1`} style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Add a piece or skill — e.g. Minuet in G, or D major scale" />
        <select aria-label="Kind" className={`${inputCls} w-28`} style={inputStyle} value={kind} onChange={(e) => setKind(e.target.value as 'piece' | 'skill')}><option value="piece">Piece</option><option value="skill">Skill</option></select>
        <Btn kind="primary" onClick={add} disabled={!title.trim()}>Add</Btn>
        <Btn kind="soft" onClick={() => { setAdding(false); setTitle('') }}>Cancel</Btn>
      </div>}
      {linked && library && library.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--clay-line)' }}>
          <p className="px-5 pt-3 text-[12px] font-bold uppercase tracking-wider sm:px-6" style={{ color: 'var(--clay-dim)' }}>In {m.name.split(' ')[0]}’s Library</p>
          {library.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-2.5 sm:px-6">
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold" style={{ color: 'var(--clay-ink)' }}>{p.title}</div>
                <div className="text-[12px]" style={{ color: 'var(--clay-dim)' }}>
                  {p.composer ? `${p.composer} · ` : ''}{p.status === 'mastered' ? 'Mastered' : p.status === 'archived' ? 'Put away' : 'Learning'}
                  {p.addedBy === 'teacher' ? ' · added by you' : ''}
                </div>
              </div>
              {p.addedBy === 'teacher' && (
                <button type="button" aria-label={`Take back ${p.title}`} onClick={() => void deletePiece(p.id)} className="p-1.5" style={{ color: 'var(--clay-dim)' }}><X size={15} /></button>
              )}
            </div>
          ))}
        </div>
      )}
      {items.length === 0 ? (linked && library && library.length > 0 ? null : <Empty fill={335} mood="excited" title="A blank page of music">Pieces and skills you add here show their progress in the report.</Empty>) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[13.5px]">
            <thead><tr className="text-[12px]" style={{ color: 'var(--clay-dim)', background: 'var(--clay-head)' }}>
              <th className="px-6 py-2 font-semibold">Piece or skill</th><th className="px-2 py-2 font-semibold">Status</th><th className="px-2 py-2 font-semibold">Tempo goal</th><th className="px-2 py-2 font-semibold">Notes and next step</th><th className="w-10" />
            </tr></thead>
            <tbody>
              {items.map((x) => {
                const st = REP_STATUS.find((s) => s.value === x.status) ?? REP_STATUS[0]
                const [bg, fg] = toneColors(st.tone)
                return (
                  <tr key={x.id} style={{ borderTop: '1px solid var(--clay-line)' }}>
                    <td className="px-6 py-2.5"><div className="font-bold" style={{ color: 'var(--clay-ink)' }}>{x.title}</div><div className="text-[12px] capitalize" style={{ color: 'var(--clay-dim)' }}>{x.kind}</div></td>
                    <td className="px-2 py-2.5">
                      <select aria-label={`Status of ${x.title}`} value={x.status} onChange={(e) => void patch(x.id, { status: e.target.value as RepertoireStatus })} className="min-h-[34px] rounded-[9px] border-0 px-2.5 text-[13px] font-bold" style={{ background: bg, color: fg }}>
                        {REP_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2.5"><input aria-label={`Tempo goal for ${x.title}`} className={`${inputCls} w-32 font-normal`} style={inputStyle} defaultValue={x.tempo ?? ''} placeholder="♩ = 72 → 88" onBlur={(e) => e.target.value !== (x.tempo ?? '') && void patch(x.id, { tempo: e.target.value })} /></td>
                    <td className="px-2 py-2.5"><input aria-label={`Notes for ${x.title}`} className={`${inputCls} font-normal`} style={inputStyle} defaultValue={x.notes ?? ''} placeholder="Next step…" onBlur={(e) => e.target.value !== (x.notes ?? '') && void patch(x.id, { notes: e.target.value })} /></td>
                    <td className="pr-4"><button type="button" aria-label={`Remove ${x.title}`} onClick={() => void save(items.filter((y) => y.id !== x.id))} className="p-1.5" style={{ color: 'var(--clay-dim)' }}><X size={15} /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
