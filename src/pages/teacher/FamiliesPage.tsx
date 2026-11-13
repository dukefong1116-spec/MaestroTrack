import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { useMembers, useStudioSettings, useCalendar } from '@/hooks/useStudioData'
import { saveFamily, createInvoice, recordPayment, updateInvoice, markInvoicesReminded, updateRosterStudent } from '@/lib/firebase/studio'
import { balanceCents, draftInvoice, paidCents, standing, toCsv, type FamilyStanding } from '@/lib/studio/billing'
import { addDays, dayKey, moneyExact, parseDay } from '@/lib/studio/dates'
import Modal from '@/components/ui/Modal'
import { StudioPage, Segmented, Pill, Check, BulkBar, BulkButton, Btn, Empty, Field } from '@/components/teacher/studio/ui'
import { inputCls, inputStyle } from '@/components/teacher/studio/tokens'
import type { Family, FamilyContact, Invoice } from '@/types'

type Filter = 'all' | 'unpaid' | 'overdue' | 'paid'
type Sort = 'balance' | 'name' | 'due'

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const monthName = (key: string) => parseDay(`${key}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function FamiliesPage() {
  const { profile } = useAuth()
  const families = useTeacherStore((s) => s.families)
  const invoices = useTeacherStore((s) => s.invoices)
  const members = useMembers()
  const today = dayKey(new Date())
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('balance')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Family | 'new' | null>(null)
  const [notice, setNotice] = useState('')

  const rows = useMemo(() => families.map((f) => {
    const mine = invoices.filter((i) => i.familyId === f.id && i.status !== 'void')
    const open = mine.filter((i) => balanceCents(i) > 0)
    return {
      f,
      kids: members.filter((m) => m.roster.familyId === f.id),
      invoices: mine,
      balance: open.reduce((a, i) => a + balanceCents(i), 0),
      due: open.map((i) => i.dueOn).sort()[0] ?? '',
      standing: standing(mine, today) as FamilyStanding,
      reminded: open.some((i) => (i.remindedAt ?? []).length > 0),
    }
  }), [families, invoices, members, today])

  const count = (k: Filter) => rows.filter((r) => k === 'all' || (k === 'unpaid' ? r.standing !== 'paid' : r.standing === k)).length
  const shown = rows
    .filter((r) => filter === 'all' || (filter === 'unpaid' ? r.standing !== 'paid' : r.standing === filter))
    .sort((a, b) => sort === 'name' ? a.f.name.localeCompare(b.f.name) : sort === 'due' ? (a.due || '9999').localeCompare(b.due || '9999') : b.balance - a.balance)
  const chosen = shown.filter((r) => sel.has(r.f.id))
  const pickedId = params.get('family') ?? shown[0]?.f.id ?? null
  const picked = rows.find((r) => r.f.id === pickedId)
  const noFamily = members.filter((m) => !m.roster.familyId || !families.some((f) => f.id === m.roster.familyId))

  const emailsOf = (f: Family) => f.contacts.map((c) => c.email).filter((e): e is string => !!e)
  const mailto = (to: string[], subject: string, body: string) => `mailto:${to.length === 1 ? encodeURIComponent(to[0]) : ''}?${to.length > 1 ? `bcc=${encodeURIComponent(to.join(','))}&` : ''}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  const studio = profile?.studioName || profile?.displayName || 'your music teacher'

  async function remind() {
    const open = chosen.flatMap((r) => r.invoices.filter((i) => balanceCents(i) > 0))
    const to = chosen.flatMap((r) => emailsOf(r.f))
    window.location.href = mailto(to, `Payment reminder from ${studio}`, `Hello,\n\nA friendly reminder that there is a balance due for music lessons. Thank you!\n\n${profile?.displayName ?? ''}`)
    await markInvoicesReminded(open.map((i) => i.id)).catch(() => {})
    setNotice(`Reminder ready in your mail app for ${chosen.length} famil${chosen.length === 1 ? 'y' : 'ies'}.`)
    setSel(new Set())
  }
  async function markPaid() {
    const open = chosen.flatMap((r) => r.invoices.filter((i) => balanceCents(i) > 0))
    await Promise.all(open.map((i) => recordPayment(i.id, { at: new Date().toISOString(), amountCents: balanceCents(i), method: 'other', note: 'Marked as paid' })))
    setNotice(`Marked ${chosen.length} famil${chosen.length === 1 ? 'y' : 'ies'} as paid.`)
    setSel(new Set())
  }
  function exportCsv() {
    const lines: (string | number)[][] = [['Family', 'Invoice', 'Line', 'Amount', 'Paid', 'Balance', 'Due']]
    for (const r of chosen) for (const i of r.invoices) {
      for (const l of i.lines) lines.push([r.f.name, monthName(i.period), l.text, (l.amountCents / 100).toFixed(2), '', '', i.dueOn])
      lines.push([r.f.name, monthName(i.period), 'Total', (i.totalCents / 100).toFixed(2), (paidCents(i) / 100).toFixed(2), (balanceCents(i) / 100).toFixed(2), i.dueOn])
    }
    download(`invoices-${today}.csv`, toCsv(lines))
  }

  return (
    <StudioPage title="Families & Invoices" subtitle="Balances, invoices and payments" actions={<Btn kind="soft" onClick={() => setEditing('new')}>+ New family</Btn>}>
      <div className="flex flex-wrap">
        <section className="min-w-0 flex-[3_1_540px]" style={{ borderRight: '1px solid var(--clay-line)' }}>
          <div className="flex flex-wrap items-center gap-2.5 px-5 py-3 sm:px-6" style={{ borderBottom: '1px solid var(--clay-line)' }}>
            <Segmented label="Show" value={filter} onChange={(v) => { setFilter(v); setSel(new Set()) }} options={[
              { value: 'all', label: `All · ${count('all')}` }, { value: 'unpaid', label: `Unpaid · ${count('unpaid')}` },
              { value: 'overdue', label: `Overdue · ${count('overdue')}` }, { value: 'paid', label: `Paid · ${count('paid')}` },
            ]} />
            <span className="flex-1" />
            <label className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--clay-dim)' }}>Sort
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="min-h-[36px] rounded-[10px] border-0 px-2.5 text-[13px] font-semibold" style={inputStyle}>
                <option value="balance">Balance, highest first</option><option value="name">Family name, A–Z</option><option value="due">Due date, soonest first</option>
              </select>
            </label>
          </div>
          {chosen.length > 0 && (
            <BulkBar label={`${chosen.length} famil${chosen.length === 1 ? 'y' : 'ies'} selected`} onClear={() => setSel(new Set())}>
              <BulkButton onClick={remind}>Send payment reminder</BulkButton>
              <BulkButton onClick={() => { window.location.href = mailto(chosen.flatMap((r) => emailsOf(r.f)), `Your invoice from ${studio}`, chosen.map((r) => `${r.f.name}: ${moneyExact(r.balance)} due`).join('\n')) }}>Email invoices</BulkButton>
              <BulkButton primary onClick={markPaid}>Mark as paid</BulkButton>
              <BulkButton onClick={exportCsv}>Export</BulkButton>
            </BulkBar>
          )}
          {notice && <p className="px-6 py-2 text-[13px] font-semibold" style={{ color: 'var(--clay-success-fg)', borderBottom: '1px solid var(--clay-line)' }}>{notice}</p>}

          {rows.length === 0 ? <Empty>No families yet. Make one with “New family”, then put students in it from here or their record.</Empty> : shown.length === 0 ? <Empty>No families match this filter.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-[13.5px]">
                <thead>
                  <tr className="text-[12px]" style={{ color: 'var(--clay-dim)', background: '#FBFAFE' }}>
                    <th className="w-8 py-2 pl-6"><Check label="Select every family shown" checked={chosen.length === shown.length} onChange={() => setSel(chosen.length === shown.length ? new Set() : new Set(shown.map((r) => r.f.id)))} /></th>
                    <th className="px-2 py-2 font-semibold">Family</th><th className="px-2 py-2 font-semibold">Students</th>
                    <th className="px-2 py-2 font-semibold">Due</th><th className="px-2 py-2 text-right font-semibold">Balance</th><th className="py-2 pl-2 pr-6 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const on = sel.has(r.f.id)
                    return (
                      <tr key={r.f.id} style={{ borderTop: '1px solid var(--clay-line)', background: on ? '#FFF6F2' : r.f.id === pickedId ? '#FBFAFE' : undefined }}>
                        <td className="py-2.5 pl-6"><Check label={`Select ${r.f.name}`} checked={on} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(r.f.id)) n.delete(r.f.id); else n.add(r.f.id); return n })} /></td>
                        <td className="px-2 py-2.5">
                          <button type="button" onClick={() => setParams({ family: r.f.id }, { replace: true })} className="text-left">
                            <span className="block font-bold" style={{ color: 'var(--clay-ink)' }}>{r.f.name}</span>
                            <span className="block text-[12px]" style={{ color: 'var(--clay-dim)' }}>{r.f.contacts[0]?.name ?? 'No contact yet'}</span>
                          </button>
                        </td>
                        <td className="px-2 py-2.5" style={{ color: '#4F4766' }}>{r.kids.map((m) => m.name.split(' ')[0]).join(', ') || '—'}</td>
                        <td className="px-2 py-2.5" style={{ color: '#4F4766' }}>{r.due ? parseDay(r.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
                        <td className="px-2 py-2.5 text-right font-bold" style={{ color: 'var(--clay-ink)' }}>{moneyExact(r.balance)}</td>
                        <td className="py-2.5 pl-2 pr-6">{r.invoices.length === 0 ? <Pill>No invoices yet</Pill> : r.standing === 'paid' ? <Pill tone="success">Paid</Pill> : r.standing === 'overdue' ? <Pill tone="danger">Overdue</Pill> : <Pill tone="warning">{r.reminded ? 'Reminder sent' : 'Unpaid'}</Pill>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {noFamily.length > 0 && (
            <div className="px-6 py-3 text-[13px]" style={{ borderTop: '1px solid var(--clay-line)', color: 'var(--clay-dim)' }}>
              Not in a family yet: {noFamily.map((m) => m.name).join(', ')}. Invoices go to families — add them from the family on the right or from their record.
            </div>
          )}
        </section>

        <section className="min-w-0 flex-[2_1_340px]">
          {picked ? <FamilyPane row={picked} onEdit={() => setEditing(picked.f)} /> : <Empty>Choose a family to see its invoices.</Empty>}
        </section>
      </div>
      {editing && <FamilyEditor family={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </StudioPage>
  )
}

function FamilyPane({ row, onEdit }: { row: { f: Family; kids: ReturnType<typeof useMembers>; invoices: Invoice[] }; onEdit: () => void }) {
  const { profile } = useAuth()
  const settings = useStudioSettings()
  const members = useMembers()
  const now = new Date()
  const [period, setPeriod] = useState(monthKey(now))
  const start = `${period}-01`
  const end = addDays(dayKey(new Date(parseDay(start).getFullYear(), parseDay(start).getMonth() + 1, 1)), -1)
  const monthItems = useCalendar(start, end)
  const draft = useMemo(() => draftInvoice(row.kids.map((m) => m.roster), monthItems, settings), [row.kids, monthItems, settings])
  const existing = row.invoices.find((i) => i.period === period)
  const [paying, setPaying] = useState<Invoice | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer' | 'other'>('transfer')
  const [busy, setBusy] = useState(false)
  const unassigned = members.filter((m) => !m.roster.familyId)
  const emails = row.f.contacts.map((c) => c.email).filter((e): e is string => !!e)
  const studio = profile?.studioName || profile?.displayName || 'your music teacher'

  async function create() {
    if (!profile) return
    setBusy(true)
    try {
      await createInvoice({
        teacherId: profile.uid, familyId: row.f.id, period, lines: draft.lines, totalCents: draft.totalCents, payments: [],
        dueOn: addDays(end, 15), status: 'open',
      })
    } finally { setBusy(false) }
  }

  const months = Array.from({ length: 6 }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  const inv = existing
  const body = inv ? `${row.f.name} — ${monthName(inv.period)}\n\n${inv.lines.map((l) => `${l.text}: ${moneyExact(l.amountCents)}`).join('\n')}\n\nTotal: ${moneyExact(inv.totalCents)}\nPaid: ${moneyExact(paidCents(inv))}\nDue ${parseDay(inv.dueOn).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}: ${moneyExact(balanceCents(inv))}\n\nThank you!\n${profile?.displayName ?? ''}` : ''

  return (
    <div className="px-5 py-4 sm:px-6">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold" style={{ color: 'var(--clay-ink)' }}>{row.f.name}</h2>
          <p className="text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>
            {row.f.contacts.map((c) => [c.name, c.email, c.phone].filter(Boolean).join(' · ')).join(' / ') || 'No contact details'}
          </p>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>Students: {row.kids.map((m) => m.name).join(', ') || 'none yet'}</p>
        </div>
        <Btn kind="link" onClick={onEdit}>Edit</Btn>
      </div>
      {unassigned.length > 0 && (
        <select aria-label="Add a student to this family" className={`${inputCls} mt-2 text-[13px]`} style={inputStyle} value="" onChange={(e) => { if (e.target.value) void updateRosterStudent(e.target.value, { familyId: row.f.id }) }}>
          <option value="">+ Add a student to this family…</option>
          {unassigned.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2" style={{ borderTop: '1px solid var(--clay-line)', paddingTop: 14 }}>
        <select aria-label="Month" className="min-h-[36px] rounded-[10px] border-0 px-2.5 text-[13px] font-semibold" style={inputStyle} value={period} onChange={(e) => setPeriod(e.target.value)}>
          {months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
        </select>
        {inv && (balanceCents(inv) === 0 ? <Pill tone="success">Paid</Pill> : inv.dueOn < dayKey(now) ? <Pill tone="danger">Overdue</Pill> : <Pill tone="warning">Unpaid</Pill>)}
      </div>

      {inv ? (
        <div className="mt-3">
          {inv.lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-3 py-2 text-[13.5px]" style={{ borderTop: '1px solid var(--clay-line)', color: 'var(--clay-ink)' }}><span>{l.text}</span><span>{moneyExact(l.amountCents)}</span></div>
          ))}
          <div className="flex justify-between pb-1 pt-3 text-[15px] font-bold" style={{ borderTop: '2px solid var(--clay-line)', color: 'var(--clay-ink)' }}><span>Total</span><span>{moneyExact(inv.totalCents)}</span></div>
          <div className="flex justify-between text-[13.5px]" style={{ color: '#4F4766' }}><span>Paid</span><span>{moneyExact(paidCents(inv))}</span></div>
          {(inv.payments ?? []).map((p, i) => (
            <p key={i} className="text-[12px]" style={{ color: 'var(--clay-dim)' }}>{new Date(p.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {p.method} · {moneyExact(p.amountCents)}{p.note ? ` · ${p.note}` : ''}</p>
          ))}
          <div className="mt-3 flex flex-wrap gap-2">
            {balanceCents(inv) > 0 && <Btn kind="primary" onClick={() => { setPaying(inv); setAmount((balanceCents(inv) / 100).toFixed(2)) }}>Record a payment</Btn>}
            {emails.length > 0
              ? <a className="inline-flex min-h-[36px] items-center rounded-[10px] px-3.5 text-[13.5px] font-semibold" style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }} href={`mailto:${encodeURIComponent(emails.join(','))}?subject=${encodeURIComponent(`Invoice from ${studio} — ${monthName(inv.period)}`)}&body=${encodeURIComponent(body)}`} onClick={() => void updateInvoice(inv.id, { sentAt: new Date().toISOString() })}>Email to family</a>
              : <Btn kind="soft" onClick={() => void navigator.clipboard?.writeText(body)}>Copy invoice text</Btn>}
            <Btn kind="link" onClick={() => void updateInvoice(inv.id, { status: 'void' })}>Void</Btn>
          </div>
          {inv.sentAt && <p className="mt-2 text-[12px]" style={{ color: 'var(--clay-dim)' }}>Emailed {new Date(inv.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.</p>}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>Made from the lessons attended in {monthName(period)}, at each student’s price. Nothing is sent until you email it.</p>
          {draft.lines.length === 0 ? <p className="py-3 text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>No attended lessons recorded this month.</p> : draft.lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-3 py-2 text-[13.5px]" style={{ borderTop: '1px solid var(--clay-line)', color: 'var(--clay-ink)' }}><span>{l.text}</span><span>{moneyExact(l.amountCents)}</span></div>
          ))}
          {draft.lines.length > 0 && <div className="flex justify-between pt-2 text-[15px] font-bold" style={{ borderTop: '2px solid var(--clay-line)', color: 'var(--clay-ink)' }}><span>Total</span><span>{moneyExact(draft.totalCents)}</span></div>}
          {draft.unrecorded > 0 && <p className="mt-2 text-[12.5px]" style={{ color: '#7A4F05' }}>{draft.unrecorded} lesson{draft.unrecorded === 1 ? ' has' : 's have'} no attendance yet and {draft.unrecorded === 1 ? 'is' : 'are'} not on it — record attendance in the calendar first.</p>}
          <Btn kind="primary" className="mt-3" onClick={create} disabled={busy || draft.lines.length === 0}>{busy ? 'Making…' : `Make the ${monthName(period).split(' ')[0]} invoice`}</Btn>
        </div>
      )}

      <Modal open={!!paying} onClose={() => setPaying(null)} title="Record a payment" size="sm">
        <div className="space-y-3">
          <Field label="Amount ($)"><input type="number" min="0" step="0.01" className={inputCls} style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="How">
            <select className={inputCls} style={inputStyle} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value="transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option>
            </select>
          </Field>
          <Btn kind="primary" className="w-full" disabled={!(Number(amount) > 0)} onClick={async () => {
            if (!paying) return
            await recordPayment(paying.id, { at: new Date().toISOString(), amountCents: Math.round(Number(amount) * 100), method })
            setPaying(null)
          }}>Save payment</Btn>
        </div>
      </Modal>
    </div>
  )
}

function FamilyEditor({ family, onClose }: { family: Family | null; onClose: () => void }) {
  const { profile } = useAuth()
  const [name, setName] = useState(family?.name ?? '')
  const [contacts, setContacts] = useState<FamilyContact[]>(family?.contacts?.length ? family.contacts : [{ name: '', email: '', phone: '' }])
  const [busy, setBusy] = useState(false)
  const set = (i: number, patch: Partial<FamilyContact>) => setContacts(contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  async function save() {
    if (!profile || !name.trim()) return
    setBusy(true)
    try {
      await saveFamily(profile.uid, {
        ...(family ?? {}), name: name.trim(),
        contacts: contacts.filter((c) => c.name.trim() || c.email?.trim()).map((c) => ({ name: c.name.trim(), ...(c.email?.trim() ? { email: c.email.trim() } : {}), ...(c.phone?.trim() ? { phone: c.phone.trim() } : {}) })),
      })
      onClose()
    } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={family ? 'Edit family' : 'New family'}>
      <div className="space-y-3">
        <Field label="Family name"><input className={inputCls} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Reyes family" /></Field>
        {contacts.map((c, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-3">
            <Field label="Parent or guardian"><input className={inputCls} style={inputStyle} value={c.name} onChange={(e) => set(i, { name: e.target.value })} /></Field>
            <Field label="Email"><input type="email" className={inputCls} style={inputStyle} value={c.email ?? ''} onChange={(e) => set(i, { email: e.target.value })} /></Field>
            <Field label="Phone"><input type="tel" className={inputCls} style={inputStyle} value={c.phone ?? ''} onChange={(e) => set(i, { phone: e.target.value })} /></Field>
          </div>
        ))}
        {contacts.length < 3 && <Btn kind="link" onClick={() => setContacts([...contacts, { name: '', email: '', phone: '' }])}>+ Another contact</Btn>}
        <div className="flex justify-end"><Btn kind="primary" onClick={save} disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save'}</Btn></div>
      </div>
    </Modal>
  )
}
