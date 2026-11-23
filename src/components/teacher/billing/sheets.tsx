import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import type { Member } from '@/hooks/useStudioData'
import { createInvoices, recordPayments, saveFamily, updateInvoice, updateRosterStudent, deleteFamily } from '@/lib/firebase/studio'
import { dueOnFor, METHODS, periodName, splitPayment, type StudentDraft } from '@/lib/studio/billing'
import { dayKey, moneyExact, parseDay } from '@/lib/studio/dates'
import { copyText, shareCard } from '@/lib/share/share'
import Modal from '@/components/ui/Modal'
import { Btn, Check, Field, Pill } from '@/components/teacher/studio/ui'
import { inputCls, inputStyle } from '@/components/teacher/studio/tokens'
import type { Family, FamilyContact, Invoice, InvoiceLine, Payment } from '@/types'

/**
 * The billing page's sheets: making a month's invoices, recording a
 * payment, an invoice to share, and a payment group. Invoices only ever
 * go from the teacher's phone to whoever pays — never to the student.
 */

const toCents = (s: string) => Math.round(Number(s) * 100)
const longDay = (d: string) => parseDay(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

/* ── Making invoices ─────────────────────────────────────────────── */

export function ReviewSheet({ drafts, period, onClose, onMade }: {
  drafts: { m: Member; d: StudentDraft }[]
  period: string
  onClose: () => void
  onMade: (n: number) => void
}) {
  const { profile } = useAuth()
  // Each student's lines as you edit them, and whether they are included.
  const [edits, setEdits] = useState(() => Object.fromEntries(drafts.map(({ m, d }) => [m.id, { on: !d.noRate && d.lines.length > 0, lines: d.lines }])))
  const [adding, setAdding] = useState<{ id: string; text: string; amount: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const chosen = drafts.filter(({ m }) => edits[m.id]?.on)
  const totalOf = (lines: InvoiceLine[]) => lines.reduce((a, l) => a + l.amountCents, 0)
  const set = (id: string, patch: Partial<{ on: boolean; lines: InvoiceLine[] }>) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }))

  async function make() {
    if (!profile || !chosen.length) return
    setBusy(true)
    setError('')
    try {
      await createInvoices(chosen.map(({ m }) => {
        const lines = edits[m.id].lines
        return {
          teacherId: profile.uid, rosterId: m.id, ...(m.roster.familyId ? { familyId: m.roster.familyId } : {}),
          period, lines, totalCents: totalOf(lines), payments: [], dueOn: dueOnFor(period), status: 'open' as const,
        }
      }))
      onMade(chosen.length)
      onClose()
    } catch {
      setError('They could not be saved. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${periodName(period)} invoices`}>
      <div className="space-y-3">
        <p className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>
          From this month’s lessons on your calendar, at each student’s price, settled up for last month. Due {longDay(dueOnFor(period))}. Change anything before you make them.
        </p>
        {drafts.map(({ m, d }) => {
          const e = edits[m.id]
          return (
            <div key={m.id} className="rounded-[14px] p-3" style={{ border: '1px solid var(--clay-line)', opacity: e.on ? 1 : 0.6 }}>
              <div className="flex items-center gap-2.5">
                <Check label={`Include ${m.name}`} checked={e.on} onChange={() => set(m.id, { on: !e.on })} />
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold" style={{ color: 'var(--clay-ink)' }}>{m.name}</span>
                <span className="text-[14.5px] font-bold tabular-nums" style={{ color: 'var(--clay-ink)' }}>{moneyExact(totalOf(e.lines))}</span>
              </div>
              {d.noRate && <p className="mt-1.5"><Pill tone="warning">No price set — add one in their record</Pill></p>}
              {e.lines.map((l, i) => (
                <div key={i} className="mt-1.5 flex items-center gap-2 text-[13px]" style={{ color: 'var(--clay-ink-soft)' }}>
                  <span className="min-w-0 flex-1">{l.text}</span>
                  <span className="tabular-nums">{moneyExact(l.amountCents)}</span>
                  <button type="button" aria-label={`Remove ${l.text}`} onClick={() => set(m.id, { lines: e.lines.filter((_, j) => j !== i) })} className="flex h-7 w-7 items-center justify-center rounded-full" style={{ color: 'var(--clay-dim)' }}><X size={15} /></button>
                </div>
              ))}
              {adding?.id === m.id ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input aria-label="What it is" placeholder="Book, discount…" className={`${inputCls} min-w-0 flex-[2_1_140px]`} style={inputStyle} value={adding.text} onChange={(ev) => setAdding({ ...adding, text: ev.target.value })} />
                  <input aria-label="Amount, minus for a discount" placeholder="$ (−10 for a discount)" inputMode="decimal" className={`${inputCls} min-w-0 flex-[1_1_100px]`} style={inputStyle} value={adding.amount} onChange={(ev) => setAdding({ ...adding, amount: ev.target.value })} />
                  <Btn kind="soft" disabled={!adding.text.trim() || !Number(adding.amount)} onClick={() => {
                    set(m.id, { lines: [...e.lines, { rosterId: m.id, kind: 'manual', text: `${m.name.split(' ')[0]} · ${adding.text.trim()}`, amountCents: toCents(adding.amount) }], on: true })
                    setAdding(null)
                  }}>Add</Btn>
                </div>
              ) : (
                <Btn kind="link" className="mt-1" onClick={() => setAdding({ id: m.id, text: '', amount: '' })}>+ Add a line</Btn>
              )}
            </div>
          )
        })}
        {error && <p className="text-[13px] font-semibold" style={{ color: '#B3263C' }}>{error}</p>}
        <Btn kind="primary" className="w-full" disabled={busy || !chosen.length} onClick={make}>
          {busy ? 'Making…' : `Make ${chosen.length} invoice${chosen.length === 1 ? '' : 's'}`}
        </Btn>
      </div>
    </Modal>
  )
}

/* ── Recording a payment ─────────────────────────────────────────── */

export function PaymentSheet({ who, owed, suggested, onClose, onSaved }: {
  who: string
  /** Every invoice it may go toward, with what is owed on each. */
  owed: { inv: Invoice; owedCents: number }[]
  suggested: number
  onClose: () => void
  onSaved: (cents: number) => void
}) {
  const [amount, setAmount] = useState(suggested > 0 ? (suggested / 100).toFixed(2) : '')
  const [method, setMethod] = useState<Payment['method']>('cash')
  const [day, setDay] = useState(dayKey(new Date()))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cents = toCents(amount)
  const several = new Set(owed.filter((o) => o.owedCents > 0).map((o) => o.inv.rosterId ?? o.inv.familyId)).size > 1

  async function save() {
    if (!(cents > 0)) return
    setBusy(true)
    setError('')
    try {
      // Noon on the day chosen, so the date never slips across midnight.
      const at = new Date(`${day}T12:00:00`).toISOString()
      const parts = splitPayment(cents, owed).map((p) => ({ id: p.id, payment: { at, amountCents: p.amountCents, method, ...(note.trim() ? { note: note.trim() } : {}) } }))
      await recordPayments(parts)
      onSaved(cents)
      onClose()
    } catch {
      setError('It could not be saved. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Payment from ${who}`} size="sm">
      <div className="space-y-3">
        <Field label="Amount ($)"><input type="number" min="0" step="0.01" inputMode="decimal" className={inputCls} style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="How they paid">
          <select className={inputCls} style={inputStyle} value={method} onChange={(e) => setMethod(e.target.value as Payment['method'])}>
            {METHODS.map(([v, name]) => <option key={v} value={v}>{name}</option>)}
          </select>
        </Field>
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={day} max={dayKey(new Date())} onChange={(e) => setDay(e.target.value || dayKey(new Date()))} /></Field>
        <Field label="Note (optional)"><input className={inputCls} style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Check #1042" /></Field>
        <p className="text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>
          {several ? 'Split over the group’s invoices, oldest first.' : 'Goes toward the oldest invoice first.'} Anything extra is kept as credit for next month.
        </p>
        {error && <p className="text-[13px] font-semibold" style={{ color: '#B3263C' }}>{error}</p>}
        <Btn kind="primary" className="w-full" disabled={busy || !(cents > 0)} onClick={save}>{busy ? 'Saving…' : `Save ${cents > 0 ? moneyExact(cents) : 'payment'}`}</Btn>
      </div>
    </Modal>
  )
}

/* ── An invoice, to look at and share ────────────────────────────── */

interface InvoiceView {
  studio: string
  teacher: string
  student: string
  payer?: string
  inv: Invoice
  /** Still owed on this invoice, after payments and credit. */
  owedCents: number
}

function invoiceText(v: InvoiceView): string {
  const { inv } = v
  return [
    v.studio,
    `Invoice · ${periodName(inv.period, true)}`,
    `For ${v.student}${v.payer ? ` · to ${v.payer}` : ''}`,
    '',
    ...inv.lines.map((l) => `${l.text}: ${moneyExact(l.amountCents)}`),
    '',
    `Total: ${moneyExact(inv.totalCents)}`,
    `Paid: ${moneyExact(Math.max(0, inv.totalCents) - v.owedCents)}`,
    v.owedCents > 0 ? `Amount due: ${moneyExact(v.owedCents)} by ${longDay(inv.dueOn)}` : 'Paid in full. Thank you!',
    '',
    `Thank you!${v.teacher ? `\n${v.teacher}` : ''}`,
  ].join('\n')
}

/** The invoice drawn as a picture, to share from the phone. */
async function invoiceImage(v: InvoiceView): Promise<Blob | null> {
  const W = 1080
  const pad = 80
  const rows = v.inv.lines.length
  const H = 760 + rows * 64
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (!g) return null
  const font = (px: number, weight = 500) => `${weight} ${px}px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`
  const ink = '#14171F'
  const dim = '#6B7280'
  const line = '#E5E7EB'
  g.fillStyle = '#FFFFFF'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#1F8FD1'
  g.fillRect(0, 0, W, 14)
  const left = (t: string, y: number, px: number, color = ink, weight = 500) => { g.font = font(px, weight); g.fillStyle = color; g.textAlign = 'left'; g.fillText(t, pad, y) }
  const right = (t: string, y: number, px: number, color = ink, weight = 500) => { g.font = font(px, weight); g.fillStyle = color; g.textAlign = 'right'; g.fillText(t, W - pad, y) }
  const rule = (y: number, w = 2) => { g.fillStyle = line; g.fillRect(pad, y, W - pad * 2, w) }
  // Text that would run into the amount is cut short.
  const fit = (t: string, px: number, max: number) => {
    g.font = font(px)
    if (g.measureText(t).width <= max) return t
    let s = t
    while (s.length > 1 && g.measureText(`${s}…`).width > max) s = s.slice(0, -1)
    return `${s}…`
  }

  left(v.studio, 140, 48, ink, 700)
  left(`Invoice · ${periodName(v.inv.period, true)}`, 196, 30, dim)
  left(`For ${v.student}`, 280, 32, ink, 600)
  if (v.payer) left(`To ${v.payer}`, 326, 28, dim)
  right(`Due ${longDay(v.inv.dueOn)}`, 280, 28, dim)
  let y = 400
  rule(y - 40)
  for (const l of v.inv.lines) {
    left(fit(l.text, 30, W - pad * 2 - 220), y, 30)
    right(moneyExact(l.amountCents), y, 30)
    y += 64
  }
  rule(y - 30, 3)
  y += 30
  left('Total', y, 32, ink, 600)
  right(moneyExact(v.inv.totalCents), y, 32, ink, 600)
  y += 56
  left('Paid', y, 28, dim)
  right(moneyExact(Math.max(0, v.inv.totalCents) - v.owedCents), y, 28, dim)
  y += 90
  left(v.owedCents > 0 ? 'Amount due' : 'Paid in full', y, 40, ink, 700)
  if (v.owedCents > 0) right(moneyExact(v.owedCents), y, 40, '#1F8FD1', 700)
  y += 90
  left(`Thank you!${v.teacher ? ` — ${v.teacher}` : ''}`, y, 28, dim)
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'))
}

export function InvoiceSheet({ view, onClose }: { view: InvoiceView; onClose: () => void }) {
  const { inv } = view
  const text = useMemo(() => invoiceText(view), [view])
  // Drawn as the sheet opens: a phone only lets Share open the share sheet
  // straight from the tap, with nothing to wait for (see lib/share).
  const [image, setImage] = useState<Blob | null>(null)
  const [notice, setNotice] = useState('')
  const [voiding, setVoiding] = useState(false)
  useEffect(() => {
    let live = true
    void invoiceImage(view).then((b) => { if (live) setImage(b) })
    return () => { live = false }
  }, [view])

  return (
    <Modal open onClose={onClose} title={`${periodName(inv.period, true)} · ${view.student}`}>
      <div className="space-y-3">
        {/* The invoice as it will look. */}
        <div className="rounded-[14px] p-4" style={{ border: '1px solid var(--clay-line)', background: 'var(--clay-surface)' }}>
          <p className="text-[16px] font-bold" style={{ color: 'var(--clay-ink)' }}>{view.studio}</p>
          <p className="text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>Invoice · {periodName(inv.period, true)} · due {longDay(inv.dueOn)}</p>
          <p className="mt-2 text-[13.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>For {view.student}{view.payer ? <span className="font-normal" style={{ color: 'var(--clay-dim)' }}> · to {view.payer}</span> : null}</p>
          <div className="mt-3">
            {inv.lines.length === 0 && <p className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>Nothing on it.</p>}
            {inv.lines.map((l, i) => (
              <div key={i} className="flex justify-between gap-3 py-1.5 text-[13.5px]" style={{ borderTop: '1px solid var(--clay-line)', color: 'var(--clay-ink)' }}>
                <span className="min-w-0">{l.text}</span><span className="shrink-0 tabular-nums">{moneyExact(l.amountCents)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between pt-2 text-[14.5px] font-bold" style={{ borderTop: '2px solid var(--clay-line)', color: 'var(--clay-ink)' }}><span>Total</span><span className="tabular-nums">{moneyExact(inv.totalCents)}</span></div>
          <div className="flex justify-between text-[13px]" style={{ color: 'var(--clay-dim)' }}><span>Paid</span><span className="tabular-nums">{moneyExact(Math.max(0, inv.totalCents) - view.owedCents)}</span></div>
          <div className="mt-1 flex justify-between text-[15px] font-bold" style={{ color: view.owedCents > 0 ? 'var(--clay-accent-ink)' : '#1F6B4A' }}>
            <span>{view.owedCents > 0 ? 'Amount due' : 'Paid in full'}</span>{view.owedCents > 0 && <span className="tabular-nums">{moneyExact(view.owedCents)}</span>}
          </div>
        </div>
        {inv.status === 'void' ? <Pill>Voided</Pill> : (
          <>
            <div className="flex gap-2">
              <Btn kind="primary" className="flex-1" disabled={!image} onClick={() => {
                if (!image) return
                void shareCard(image, text).then((o) => {
                  if (o === 'cancelled') return
                  void updateInvoice(inv.id, { sentAt: new Date().toISOString() }).catch(() => {})
                  setNotice(o === 'shared' ? 'Shared.' : 'Saved as a picture.')
                })
              }}>Share invoice</Btn>
              <Btn kind="soft" className="flex-1" onClick={() => void copyText(text).then((ok) => setNotice(ok ? 'Copied — paste it into a text or email.' : 'Could not copy.'))}>Copy as text</Btn>
            </div>
            <p className="text-[12px]" style={{ color: 'var(--clay-dim)' }}>Send it to whoever pays. Students never see invoices.</p>
            {voiding ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[13px]" style={{ color: 'var(--clay-ink)' }}>Void this invoice? Payments on it stay as credit.</span>
                <Btn kind="soft" onClick={() => setVoiding(false)}>Keep</Btn>
                <Btn kind="primary" style={{ background: '#B3263C' }} onClick={() => void updateInvoice(inv.id, { status: 'void' }).then(onClose)}>Void</Btn>
              </div>
            ) : <Btn kind="link" onClick={() => setVoiding(true)}>Void invoice</Btn>}
          </>
        )}
        {inv.sentAt && <p className="text-[12px]" style={{ color: 'var(--clay-dim)' }}>Last sent {new Date(inv.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.</p>}
        {notice && <p className="text-[13px] font-semibold" style={{ color: '#1F6B4A' }}>{notice}</p>}
      </div>
    </Modal>
  )
}

/* ── A payment group ─────────────────────────────────────────────── */

export function GroupEditor({ group, members, start, onClose, deletable }: {
  group: Family | null
  members: Member[]
  /** Students ticked when making a new group. */
  start?: string[]
  onClose: () => void
  /** False when older invoices still belong to it. */
  deletable: boolean
}) {
  const { profile } = useAuth()
  const [name, setName] = useState(group?.name ?? '')
  const [contacts, setContacts] = useState<FamilyContact[]>(group?.contacts?.length ? group.contacts : [{ name: '', email: '', phone: '' }])
  const [picked, setPicked] = useState<Set<string>>(() => new Set(group ? members.filter((m) => m.roster.familyId === group.id).map((m) => m.id) : start ?? []))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const setContact = (i: number, patch: Partial<FamilyContact>) => setContacts(contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)))

  async function save() {
    if (!profile || !name.trim()) return
    setBusy(true)
    setError('')
    try {
      const id = await saveFamily(profile.uid, {
        ...(group ?? {}), name: name.trim(),
        contacts: contacts.filter((c) => c.name.trim() || c.email?.trim() || c.phone?.trim()).map((c) => ({ name: c.name.trim(), ...(c.email?.trim() ? { email: c.email.trim() } : {}), ...(c.phone?.trim() ? { phone: c.phone.trim() } : {}) })),
      })
      await Promise.all(members.flatMap((m) => {
        const inIt = m.roster.familyId === id
        if (picked.has(m.id) && !inIt) return [updateRosterStudent(m.id, { familyId: id })]
        if (!picked.has(m.id) && inIt) return [updateRosterStudent(m.id, { familyId: undefined })]
        return []
      }))
      onClose()
    } catch {
      setError('It could not be saved. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!group) return
    setBusy(true)
    try {
      await Promise.all(members.filter((m) => m.roster.familyId === group.id).map((m) => updateRosterStudent(m.id, { familyId: undefined })))
      await deleteFamily(group.id)
      onClose()
    } catch {
      setError('It could not be deleted. Check your connection and try again.')
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={group ? 'Edit group' : 'New payment group'}>
      <div className="space-y-3">
        <p className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>Students who are paid for together. Each still gets their own invoice; one payment can cover them all.</p>
        <Field label="Group name"><input className={inputCls} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Reyes" /></Field>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold" style={{ color: 'var(--clay-ink)' }}>Students</p>
          <div className="max-h-56 overflow-y-auto rounded-[12px]" style={{ border: '1px solid var(--clay-line)' }}>
            {members.map((m) => {
              const elsewhere = !busy && m.roster.familyId && m.roster.familyId !== group?.id
              return (
                <label key={m.id} className="flex items-center gap-2.5 px-3 py-2 text-[14px]" style={{ borderTop: '1px solid var(--clay-line)', color: 'var(--clay-ink)' }}>
                  <Check label={`Include ${m.name}`} checked={picked.has(m.id)} onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n })} />
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  {elsewhere && <span className="text-[12px]" style={{ color: 'var(--clay-dim)' }}>in another group</span>}
                </label>
              )
            })}
          </div>
        </div>
        {contacts.map((c, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-3">
            <Field label={i === 0 ? 'Who pays' : 'Also'}><input className={inputCls} style={inputStyle} value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} placeholder="Maria Reyes" /></Field>
            <Field label="Email"><input type="email" className={inputCls} style={inputStyle} value={c.email ?? ''} onChange={(e) => setContact(i, { email: e.target.value })} /></Field>
            <Field label="Phone"><input type="tel" className={inputCls} style={inputStyle} value={c.phone ?? ''} onChange={(e) => setContact(i, { phone: e.target.value })} /></Field>
          </div>
        ))}
        {contacts.length < 2 && <Btn kind="link" onClick={() => setContacts([...contacts, { name: '', email: '', phone: '' }])}>+ Another contact</Btn>}
        {error && <p className="text-[13px] font-semibold" style={{ color: '#B3263C' }}>{error}</p>}
        <div className="flex items-center gap-2">
          {group && deletable && <Btn kind="link" style={{ color: '#B3263C' }} disabled={busy} onClick={remove}>Delete group</Btn>}
          <span className="flex-1" />
          <Btn kind="primary" onClick={save} disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save'}</Btn>
        </div>
      </div>
    </Modal>
  )
}
