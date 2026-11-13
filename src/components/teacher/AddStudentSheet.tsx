import { useState } from 'react'
import { QrCode, UserPlus } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import InviteSheet from '@/components/teacher/InviteSheet'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { useStudioSettings } from '@/hooks/useStudioData'
import { createRosterStudent, saveFamily } from '@/lib/firebase/studio'
import { LENGTH_CHOICES } from '@/lib/studio/settings'
import { Btn, Field } from '@/components/teacher/studio/ui'
import { inputCls, inputStyle } from '@/components/teacher/studio/tokens'

const INSTRUMENTS = ['Piano', 'Violin', 'Viola', 'Cello', 'Guitar', 'Voice', 'Flute', 'Clarinet', 'Saxophone', 'Trumpet', 'Drums', 'Other']

/**
 * Two ways to add a student. The invitation is the one the app already
 * had, unchanged: a QR, a code to read out, a link — they join once you
 * accept. Or keep a record for someone not on the app, to invite later.
 */
export default function AddStudentSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded?: (rosterId: string) => void }) {
  const { profile } = useAuth()
  const families = useTeacherStore((s) => s.families)
  const settings = useStudioSettings()
  const [mode, setMode] = useState<'choose' | 'invite' | 'record'>('choose')
  const [name, setName] = useState('')
  const [instrument, setInstrument] = useState('Piano')
  const [family, setFamily] = useState('new')
  const [parent, setParent] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [length, setLength] = useState('default')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setMode('choose'); setName(''); setInstrument('Piano'); setFamily('new'); setParent(''); setEmail(''); setPhone(''); setLength('default'); setError('')
  }
  function close() { reset(); onClose() }

  async function save() {
    if (!profile || !name.trim()) return
    setBusy(true)
    setError('')
    try {
      let familyId = family === 'new' ? undefined : family
      if (family === 'new' && (parent.trim() || email.trim())) {
        const last = name.trim().split(/\s+/).slice(-1)[0]
        familyId = await saveFamily(profile.uid, { name: `${last} family`, contacts: [{ name: parent.trim() || `${last} family`, email: email.trim() || undefined, phone: phone.trim() || undefined }] })
      }
      const id = await createRosterStudent(profile.uid, {
        uid: null,
        name: name.trim(),
        instrument,
        familyId,
        lessonMinutes: length === 'default' ? null : Number(length),
        parentName: parent.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      })
      onAdded?.(id)
      close()
    } catch (e) {
      console.error('[AddStudent] could not save', e)
      setError('Could not save. If this keeps happening, the studio rules may not be published yet.')
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'invite' && profile) {
    return <InviteSheet open={open} onClose={close} profile={profile} />
  }

  return (
    <Modal open={open} onClose={close} title="Add a student">
      {mode === 'choose' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setMode('invite')} className="flex flex-col items-start gap-2 rounded-2xl p-4 text-left transition-transform active:scale-[.98]" style={{ background: 'var(--clay-accent-soft)' }}>
            <QrCode size={22} style={{ color: 'var(--clay-accent-ink)' }} aria-hidden="true" />
            <span className="text-[15px] font-bold" style={{ color: 'var(--clay-ink)' }}>Invite to the app</span>
            <span className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>A QR code, a code to read out, or a link. They join once you accept.</span>
          </button>
          <button type="button" onClick={() => setMode('record')} className="flex flex-col items-start gap-2 rounded-2xl p-4 text-left transition-transform active:scale-[.98]" style={{ background: 'var(--clay-bg)' }}>
            <UserPlus size={22} style={{ color: 'var(--clay-ink)' }} aria-hidden="true" />
            <span className="text-[15px] font-bold" style={{ color: 'var(--clay-ink)' }}>Add without an account</span>
            <span className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>Keep their lessons, notes and invoices here; invite them whenever you like.</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Student’s name"><input className={inputCls} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Leo Martins" autoFocus /></Field>
            <Field label="Instrument">
              <select className={inputCls} style={inputStyle} value={instrument} onChange={(e) => setInstrument(e.target.value)}>
                {INSTRUMENTS.map((i) => <option key={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="Family">
              <select className={inputCls} style={inputStyle} value={family} onChange={(e) => setFamily(e.target.value)}>
                <option value="new">New family</option>
                {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
            <Field label="Lesson length">
              <select className={inputCls} style={inputStyle} value={length} onChange={(e) => setLength(e.target.value)}>
                <option value="default">Studio default ({settings.defaultLessonMinutes} min)</option>
                {LENGTH_CHOICES.filter((m) => m !== settings.defaultLessonMinutes).map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </Field>
            {family === 'new' && (
              <>
                <Field label="Parent or guardian"><input className={inputCls} style={inputStyle} value={parent} onChange={(e) => setParent(e.target.value)} placeholder="Name" /></Field>
                <Field label="Email"><input type="email" className={inputCls} style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@email.com" /></Field>
                <Field label="Phone"><input type="tel" className={inputCls} style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              </>
            )}
          </div>
          {error && <p className="text-[13px]" style={{ color: 'var(--clay-danger)' }}>{error}</p>}
          <div className="flex justify-between gap-2 pt-1">
            <Btn kind="link" onClick={() => setMode('choose')}>‹ Back</Btn>
            <Btn kind="primary" onClick={save} disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Add student'}</Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}
