import { ChevronRight, Download, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { useMembers, useStudioSettings, useCalendar, type Member } from '@/hooks/useStudioData'
import { markInvoicesReminded, updateRosterStudent } from '@/lib/firebase/studio'
import { accountOf, draftMonthly, monthRange, paidCents, periodName, prevPeriod, toCsv, METHODS, type Account } from '@/lib/studio/billing'
import { lessonPriceCents } from '@/lib/studio/settings'
import { dayKey, moneyExact, parseDay } from '@/lib/studio/dates'
import { copyText } from '@/lib/share/share'
import { StudioPage, Pill, Btn, Empty, Avatar, SectionTitle } from '@/components/teacher/studio/ui'
import { colorFor, inputStyle } from '@/components/teacher/studio/tokens'
import { GroupEditor, InvoiceSheet, PaymentSheet, ReviewSheet } from '@/components/teacher/billing/sheets'
import type { Family, Invoice, Payment } from '@/types'

/**
 * Billing: each student is invoiced once a month, at the start of it, for
 * that month's lessons (lib/studio/billing). Students who are paid for
 * together can share a payment group, so one payment covers them all.
 *
 * Invoices are the teacher's alone: the rules let no one else read them,
 * and they only leave this page when the teacher shares one with whoever
 * pays. Students never see them.
 */

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const shortDay = (d: string) => parseDay(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const methodName = (m: string) => METHODS.find(([v]) => v === m)?.[1] ?? m

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** One row on the page: a student on their own, or a payment group. */
interface Unit {
  key: string
  name: string
  group?: Family
  people: Member[]
  invoices: Invoice[]
  account: Account
}

function standingPill(a: Account, hasInvoices: boolean) {
  if (!hasInvoices) return <Pill>No invoices yet</Pill>
  if (a.standing === 'overdue') return <Pill tone="danger">Overdue</Pill>
  if (a.standing === 'unpaid') return <Pill tone="warning">Due {shortDay(a.dueOn)}</Pill>
  return a.balanceCents < 0 ? <Pill tone="success">{moneyExact(-a.balanceCents)} credit</Pill> : <Pill tone="success">Paid</Pill>
}

export default function FamiliesPage() {
  const { profile } = useAuth()
  const groups = useTeacherStore((s) => s.families)
  const invoices = useTeacherStore((s) => s.invoices)
  const members = useMembers()
  const settings = useStudioSettings()
  // Until the lists arrive (with no copy saved on this phone), a spinner,
  // not a misleading "nothing to bill" and $0.
  const ready = useTeacherStore((s) => (s.live.roster && s.live.invoices && s.live.lessons) || s.roster.length > 0 || s.invoices.length > 0)
  const [params, setParams] = useSearchParams()
  const today = dayKey(new Date())
  const [period, setPeriod] = useState(monthKey(new Date()))
  const prev = prevPeriod(period)
  const [start, end] = monthRange(period)
  const items = useCalendar(monthRange(prev)[0], end)
  const monthItems = useMemo(() => items.filter((i) => i.date >= start), [items, start])
  const prevItems = useMemo(() => items.filter((i) => i.date < start), [items, start])
  // The drafts being reviewed, as they were when the sheet opened: making
  // them takes them off the live list, and the sheet must not empty itself.
  const [reviewing, setReviewing] = useState<typeof drafts | null>(null)
  const [editing, setEditing] = useState<{ group: Family | null; start?: string[] } | null>(null)
  const [notice, setNotice] = useState('')

  const live = useMemo(() => invoices.filter((i) => i.status !== 'void'), [invoices])

  // Rows: each group with students in it, then everyone not in a group.
  const units = useMemo<Unit[]>(() => {
    const out: Unit[] = []
    const grouped = new Set<string>()
    for (const g of groups) {
      const people = members.filter((m) => m.roster.familyId === g.id)
      // The group's older family invoices count too.
      const inv = [...people.flatMap((m) => invoices.filter((i) => i.rosterId === m.id)), ...invoices.filter((i) => !i.rosterId && i.familyId === g.id)]
      if (!people.length && !inv.some((i) => i.status !== 'void')) continue
      people.forEach((m) => grouped.add(m.id))
      out.push({ key: `g:${g.id}`, name: g.name, group: g, people, invoices: inv, account: accountOf(inv, today) })
    }
    for (const m of members) {
      if (grouped.has(m.id)) continue
      const inv = invoices.filter((i) => i.rosterId === m.id)
      out.push({ key: `s:${m.id}`, name: m.name, people: [m], invoices: inv, account: accountOf(inv, today) })
    }
    return out
  }, [groups, members, invoices, today])

  // Students with lessons this month and no invoice for it yet.
  const drafts = useMemo(() => members
    .filter((m) => !live.some((i) => i.rosterId === m.id && i.period === period))
    .map((m) => ({ m, d: draftMonthly(m.roster, period, monthItems, prevItems, live.find((i) => i.rosterId === m.id && i.period === prev), settings) }))
    .filter(({ d }) => d.lines.length > 0 || d.lessons > 0),
  [members, live, period, prev, monthItems, prevItems, settings])

  const withInvoices = units.filter((u) => u.invoices.some((i) => i.status !== 'void'))
  const overdue = withInvoices.filter((u) => u.account.standing === 'overdue').sort((a, b) => b.account.balanceCents - a.account.balanceCents)
  const unpaid = withInvoices.filter((u) => u.account.standing === 'unpaid').sort((a, b) => a.account.dueOn.localeCompare(b.account.dueOn))
  const paid = withInvoices.filter((u) => u.account.standing === 'paid' && u.invoices.some((i) => i.period === period && i.status !== 'void'))
  const owed = withInvoices.reduce((a, u) => a + Math.max(0, u.account.balanceCents), 0)
  const late = withInvoices.reduce((a, u) => a + u.account.invoices.filter((x) => x.owedCents > 0 && x.inv.dueOn < today).reduce((s, x) => s + x.owedCents, 0), 0)
  const paidIn = live.reduce((a, i) => a + (i.payments ?? []).filter((p) => p.at && monthKey(new Date(p.at)) === period).reduce((s, p) => s + p.amountCents, 0), 0)

  const months = Array.from({ length: 13 }, (_, i) => { const now = new Date(); return monthKey(new Date(now.getFullYear(), now.getMonth() + 1 - i, 1)) })
  const open = params.get('s') ? { kind: 's' as const, id: params.get('s')! } : params.get('g') ? { kind: 'g' as const, id: params.get('g')! } : null
  const go = (next: { s?: string; g?: string } | null) => setParams(next ? (next as Record<string, string>) : {}, { replace: false })

  function exportCsv() {
    const rows: (string | number)[][] = [['Student', 'Month', 'Line', 'Amount', 'Paid', 'Due date']]
    for (const i of live.filter((x) => x.period === period)) {
      const who = members.find((m) => m.id === i.rosterId)?.name ?? groups.find((g) => g.id === i.familyId)?.name ?? ''
      for (const l of i.lines) rows.push([who, periodName(i.period, true), l.text, (l.amountCents / 100).toFixed(2), '', i.dueOn])
      rows.push([who, periodName(i.period, true), 'Total', (i.totalCents / 100).toFixed(2), (paidCents(i) / 100).toFixed(2), i.dueOn])
    }
    download(`invoices-${period}.csv`, toCsv(rows))
  }

  const sheets = (
    <>
      {reviewing && <ReviewSheet drafts={reviewing} period={period} onClose={() => setReviewing(null)} onMade={(n) => setNotice(`Made ${n} invoice${n === 1 ? '' : 's'} for ${periodName(period)}.`)} />}
      {editing && <GroupEditor group={editing.group} start={editing.start} members={members} onClose={() => setEditing(null)}
        deletable={!editing.group || !invoices.some((i) => !i.rosterId && i.familyId === editing.group!.id)} />}
    </>
  )

  if (open) {
    const unit = open.kind === 'g' ? units.find((u) => u.group?.id === open.id) : undefined
    const member = open.kind === 's' ? members.find((m) => m.id === open.id) : undefined
    if (unit || member) {
      return (
        <>
          <Detail
            unit={unit}
            member={member}
            groups={groups}
            invoices={member ? invoices.filter((i) => i.rosterId === member.id) : unit!.invoices}
            draft={drafts.find(({ m }) => m.id === member?.id)}
            period={period}
            onOpen={go}
            onMake={(ids) => setReviewing(drafts.filter(({ m }) => ids.includes(m.id)))}
            onEditGroup={(g, startIds) => setEditing({ group: g, start: startIds })}
            studio={profile?.studioName || profile?.displayName || 'Music lessons'}
            teacher={profile?.displayName ?? ''}
          />
          {sheets}
        </>
      )
    }
  }

  const row = (u: Unit) => {
    const m = u.people[0]
    return (
      <button key={u.key} type="button" onClick={() => go(u.group ? { g: u.group.id } : { s: m.id })} className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors active:bg-[var(--clay-bg)] sm:px-6" style={{ borderTop: '1px solid var(--clay-line)' }}>
        {u.group
          ? <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--clay-bg-deep)', color: 'var(--clay-ink-soft)' }}><Users size={18} /></span>
          : <Avatar name={m.name} color={colorFor(m.id)} size={38} src={m.profile?.avatar} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold" style={{ color: 'var(--clay-ink)' }}>{u.name}</span>
          <span className="block truncate text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>{u.group ? u.people.map((p) => p.name.split(' ')[0]).join(', ') || 'No students' : (m.roster.parentName || m.roster.email || '')}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[15px] font-bold tabular-nums" style={{ color: 'var(--clay-ink)' }}>{moneyExact(Math.max(0, u.account.balanceCents))}</span>
          {standingPill(u.account, true)}
        </span>
        <ChevronRight size={16} className="shrink-0" style={{ color: 'var(--clay-dim)' }} />
      </button>
    )
  }

  const section = (title: string, list: Unit[]) => list.length > 0 && (
    <section>
      <SectionTitle>{title} <span className="font-semibold" style={{ color: 'var(--clay-dim)' }}>· {list.length}</span></SectionTitle>
      {list.map(row)}
    </section>
  )

  return (
    <StudioPage
      back={{ to: '/teacher/more', label: 'More', phoneOnly: true }}
      title="Billing"
      subtitle="Monthly invoices and payments"
      actions={<Btn kind="soft" onClick={() => setEditing({ group: null })}><Users size={15} /> New group</Btn>}
    >
      <div className="flex items-center gap-2 px-5 pt-3 sm:px-6">
        <select aria-label="Month" value={period} onChange={(e) => { setPeriod(e.target.value); setNotice('') }} className="min-h-[38px] rounded-[10px] border-0 px-2.5 text-[14px] font-semibold" style={inputStyle}>
          {months.map((k) => <option key={k} value={k}>{periodName(k, true)}</option>)}
        </select>
        <span className="flex-1" />
        <Btn kind="link" onClick={exportCsv}><Download size={15} /> Export</Btn>
      </div>

      {/* Where things stand, at a glance. */}
      <div className="grid grid-cols-3 gap-2 px-5 py-3 sm:px-6">
        {([['Owed', owed, 'var(--clay-ink)'], ['Overdue', late, late ? '#B3263C' : 'var(--clay-ink)'], [`Paid in ${periodName(period)}`, paidIn, '#1F6B4A']] as const).map(([label, cents, color]) => (
          <div key={label} className="rounded-[14px] px-3 py-2.5" style={{ background: 'var(--clay-bg)' }}>
            <p className="truncate text-[12px] font-semibold" style={{ color: 'var(--clay-dim)' }}>{label}</p>
            <p className="text-[18px] font-bold tabular-nums" style={{ color }}>{moneyExact(cents)}</p>
          </div>
        ))}
      </div>
      {notice && <p className="px-6 pb-2 text-[13px] font-semibold" style={{ color: '#1F6B4A' }}>{notice}</p>}

      {drafts.length > 0 && (
        <section className="mx-5 mb-3 rounded-[16px] sm:mx-6" style={{ border: '1px solid var(--clay-line)' }}>
          <div className="flex items-center gap-2 px-4 pb-1 pt-3">
            <h2 className="flex-1 text-[15px] font-bold" style={{ color: 'var(--clay-ink)' }}>Not invoiced yet <span className="font-semibold" style={{ color: 'var(--clay-dim)' }}>· {drafts.length}</span></h2>
            <Btn kind="primary" onClick={() => setReviewing(drafts)}>Make {drafts.length === 1 ? 'invoice' : `all ${drafts.length}`}</Btn>
          </div>
          <p className="px-4 pb-2 text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>{periodName(period)} lessons on your calendar, with nothing billed for them yet.</p>
          {drafts.map(({ m, d }) => (
            <button key={m.id} type="button" onClick={() => setReviewing(drafts.filter((x) => x.m.id === m.id))} className="flex w-full items-center gap-3 px-4 py-2.5 text-left" style={{ borderTop: '1px solid var(--clay-line)' }}>
              <Avatar name={m.name} color={colorFor(m.id)} size={32} src={m.profile?.avatar} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{m.name}</span>
                <span className="block text-[12px]" style={{ color: 'var(--clay-dim)' }}>{d.lessons} lesson{d.lessons === 1 ? '' : 's'} × {moneyExact(lessonPriceCents(m.roster, settings))}</span>
              </span>
              {d.noRate ? <Pill tone="warning">No price set</Pill> : <span className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--clay-ink)' }}>{moneyExact(d.totalCents)}</span>}
            </button>
          ))}
        </section>
      )}

      {section('Overdue', overdue)}
      {section('Waiting for payment', unpaid)}
      {section(`Paid for ${periodName(period)}`, paid)}
      {!ready && (
        <div className="flex justify-center py-16" role="status" aria-label="Loading">
          <div className="h-8 w-8 animate-spin rounded-full" style={{ border: '3px solid var(--clay-accent-soft)', borderTopColor: 'var(--clay-accent)' }} />
        </div>
      )}
      {ready && !withInvoices.length && !drafts.length && (
        <Empty fill mood="in-love" title="Nothing to bill yet">When your students have lessons on the calendar, they show up here, ready to invoice for the month.</Empty>
      )}
      <div className="h-4" />
      {sheets}
    </StudioPage>
  )
}

/* ── One student, or one group ───────────────────────────────────── */

function Detail({ unit, member, groups, invoices, draft, period, onOpen, onMake, onEditGroup, studio, teacher }: {
  unit?: Unit
  member?: Member
  groups: Family[]
  invoices: Invoice[]
  draft?: { m: Member; d: ReturnType<typeof draftMonthly> }
  period: string
  onOpen: (next: { s?: string; g?: string }) => void
  onMake: (ids: string[]) => void
  onEditGroup: (g: Family | null, start?: string[]) => void
  studio: string
  teacher: string
}) {
  const today = dayKey(new Date())
  const group = unit?.group ?? groups.find((g) => g.id === member?.roster.familyId)
  const account = useMemo(() => accountOf(invoices, today), [invoices, today])
  const [paying, setPaying] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const name = member?.name ?? unit!.name
  const payer = group?.contacts[0]?.name || member?.roster.parentName || ''
  const contact = group?.contacts[0] ?? (member ? { name: member.roster.parentName ?? '', email: member.roster.email, phone: member.roster.phone } : undefined)
  const nameOf = (i: Invoice) => member?.name ?? unit?.people.find((p) => p.id === i.rosterId)?.name ?? group?.name ?? ''
  const owedOn = new Map(account.invoices.map((x) => [x.inv.id, x.owedCents]))
  const shown = [...invoices].filter((i) => i.status !== 'void').sort((a, b) => b.period.localeCompare(a.period) || b.createdAt.localeCompare(a.createdAt))
  // One payment split over several invoices is one row, with who it covered.
  const payments = [...invoices.flatMap((i) => (i.payments ?? []).map((p) => ({ ...p, who: nameOf(i).split(' ')[0] })))
    .reduce((acc, p) => {
      const k = `${p.at}|${p.method}|${p.note ?? ''}`
      const had = acc.get(k)
      acc.set(k, had ? { ...had, amountCents: had.amountCents + p.amountCents, who: had.who.includes(p.who) ? had.who : `${had.who}, ${p.who}` } : p)
      return acc
    }, new Map<string, Payment & { who: string }>()).values()].sort((a, b) => b.at.localeCompare(a.at))
  const viewed = invoices.find((i) => i.id === viewing)

  async function remind() {
    const first = member ? member.name.split(' ')[0] : unit!.people.map((p) => p.name.split(' ')[0]).join(' and ')
    const text = `Hi${payer ? ` ${payer.split(' ')[0]}` : ''}, a friendly reminder that ${moneyExact(account.balanceCents)} for ${first}’s lessons ${account.dueOn < today ? `was due on ${shortDay(account.dueOn)}` : `is due on ${shortDay(account.dueOn)}`}. Thank you!${teacher ? `\n${teacher}` : ''}`
    const ok = await copyText(text)
    if (ok) await markInvoicesReminded(account.invoices.filter((x) => x.owedCents > 0).map((x) => x.inv.id)).catch(() => {})
    setNotice(ok ? 'Reminder copied — paste it into a text or email.' : 'Could not copy.')
  }

  return (
    <StudioPage back={{ to: '/teacher/families', label: 'Billing' }} title={name} subtitle={group && member ? `In the ${group.name} group` : unit ? `Payment group · ${unit.people.length} student${unit.people.length === 1 ? '' : 's'}` : 'Billing'}
      actions={unit ? <Btn kind="soft" onClick={() => onEditGroup(unit.group!)}>Edit group</Btn> : undefined}>

      {/* What they owe, and the two things you do here. */}
      <div className="px-5 py-4 sm:px-6">
        <p className="text-[13px] font-semibold" style={{ color: 'var(--clay-dim)' }}>{account.balanceCents > 0 ? 'Owes' : account.balanceCents < 0 ? 'In credit' : 'Balance'}</p>
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-[30px] font-bold tabular-nums" style={{ color: account.standing === 'overdue' ? '#B3263C' : 'var(--clay-ink)' }}>{moneyExact(Math.abs(account.balanceCents))}</p>
          {shown.length > 0 && standingPill(account, true)}
        </div>
        {contact && (contact.name || contact.email || contact.phone) && (
          <p className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>Paid by {[contact.name, contact.email, contact.phone].filter(Boolean).join(' · ')}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {shown.length > 0 && <Btn kind="primary" onClick={() => setPaying(true)}>Record payment</Btn>}
          {draft && <Btn kind={shown.length ? 'soft' : 'primary'} onClick={() => onMake([draft.m.id])}>Make {periodName(period)} invoice</Btn>}
          {unit && (() => {
            const due = unit.people.filter((p) => !invoices.some((i) => i.rosterId === p.id && i.period === period && i.status !== 'void'))
            return due.length > 0 ? <Btn kind="soft" onClick={() => onMake(due.map((p) => p.id))}>Make {periodName(period)} invoices</Btn> : null
          })()}
          {account.balanceCents > 0 && <Btn kind="soft" onClick={remind}>Copy reminder</Btn>}
        </div>
        {notice && <p className="mt-2 text-[13px] font-semibold" style={{ color: '#1F6B4A' }}>{notice}</p>}
      </div>

      {/* A group's students; a student's group. */}
      {unit ? (
        <section>
          <SectionTitle>Students</SectionTitle>
          {unit.people.map((p) => {
            const a = accountOf(invoices.filter((i) => i.rosterId === p.id), today)
            return (
              <button key={p.id} type="button" onClick={() => onOpen({ s: p.id })} className="flex w-full items-center gap-3 px-5 py-2.5 text-left sm:px-6" style={{ borderTop: '1px solid var(--clay-line)' }}>
                <Avatar name={p.name} color={colorFor(p.id)} size={32} src={p.profile?.avatar} />
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{p.name}</span>
                <span className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--clay-ink)' }}>{moneyExact(Math.max(0, a.balanceCents))}</span>
                <ChevronRight size={16} style={{ color: 'var(--clay-dim)' }} />
              </button>
            )
          })}
        </section>
      ) : member && (
        <div className="flex flex-wrap items-center gap-2 px-5 pb-3 sm:px-6">
          <span className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>Payment group</span>
          <select aria-label="Payment group" className="min-h-[36px] rounded-[10px] border-0 px-2.5 text-[13px] font-semibold" style={inputStyle} value={member.roster.familyId && groups.some((g) => g.id === member.roster.familyId) ? member.roster.familyId : ''}
            onChange={(e) => {
              if (e.target.value === '+') onEditGroup(null, [member.id])
              else void updateRosterStudent(member.id, { familyId: e.target.value || undefined })
            }}>
            <option value="">None — pays alone</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            <option value="+">+ New group…</option>
          </select>
          {group && <Btn kind="link" onClick={() => onOpen({ g: group.id })}>Open group</Btn>}
        </div>
      )}

      <section>
        <SectionTitle>Invoices</SectionTitle>
        {shown.length === 0 && <p className="px-6 pb-3 text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>No invoices yet.</p>}
        {shown.map((i) => {
          const owedHere = owedOn.get(i.id) ?? 0
          return (
            <button key={i.id} type="button" onClick={() => setViewing(i.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left sm:px-6" style={{ borderTop: '1px solid var(--clay-line)' }}>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{periodName(i.period, true)}{unit && i.rosterId ? ` · ${nameOf(i).split(' ')[0]}` : ''}</span>
                <span className="block text-[12px]" style={{ color: 'var(--clay-dim)' }}>{i.rosterId ? `Due ${shortDay(i.dueOn)}` : 'Family invoice'}{i.sentAt ? ' · sent' : ''}</span>
              </span>
              <span className="text-[14.5px] font-bold tabular-nums" style={{ color: 'var(--clay-ink)' }}>{moneyExact(i.totalCents)}</span>
              {owedHere === 0 ? <Pill tone="success">Paid</Pill> : i.dueOn < today ? <Pill tone="danger">{moneyExact(owedHere)} late</Pill> : <Pill tone="warning">{moneyExact(owedHere)} due</Pill>}
            </button>
          )
        })}
      </section>

      {payments.length > 0 && (
        <section>
          <SectionTitle>Payments</SectionTitle>
          {payments.map((p, k) => (
            <div key={k} className="flex items-center gap-3 px-5 py-2.5 text-[13.5px] sm:px-6" style={{ borderTop: '1px solid var(--clay-line)', color: 'var(--clay-ink)' }}>
              <span className="w-16 shrink-0" style={{ color: 'var(--clay-dim)' }}>{p.at ? new Date(p.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
              <span className="min-w-0 flex-1 truncate">{methodName(p.method)}{unit ? ` · ${p.who}` : ''}{p.note ? ` · ${p.note}` : ''}</span>
              <span className="font-bold tabular-nums">{moneyExact(p.amountCents)}</span>
            </div>
          ))}
        </section>
      )}
      <div className="h-4" />

      {paying && <PaymentSheet who={payer || name} owed={account.invoices} suggested={Math.max(0, account.balanceCents)} onClose={() => setPaying(false)} onSaved={(c) => setNotice(`${moneyExact(c)} recorded.`)} />}
      {viewed && <InvoiceSheet view={{ studio, teacher, student: nameOf(viewed), payer: payer || undefined, inv: viewed, owedCents: owedOn.get(viewed.id) ?? 0 }} onClose={() => setViewing(null)} />}
    </StudioPage>
  )
}
