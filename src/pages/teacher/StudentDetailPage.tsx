import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import Sticker from '@/components/stickers/Sticker'
import { format, parseISO } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { subscribePracticeSummary } from '@/lib/firebase/summary'
import { sessionsFromSummary } from '@/lib/utils/summary'
import { addTeacherNote, deleteTeacherNote, subscribeTeacherNotes } from '@/lib/firebase/teacher'
import { createAssignment, deleteAssignment, subscribeTeacherStudentAssignments } from '@/lib/firebase/assignments'
import { normaliseStatus, needsReview, deriveDailyProgress, deriveProgress } from '@/lib/utils/assignments'
import DailyStrip from '@/components/assignments/DailyStrip'
import ReviewSheet from '@/components/assignments/ReviewSheet'
import { subscribeSharedRecordings } from '@/lib/firebase/recordings'
import { getAnalyticsSummary, getDailyData, getCategoryData, getHeatmapData } from '@/lib/utils/analytics'
import { getTheme } from '@/lib/utils/instruments'
import InstrumentIcon from '@/components/icons/InstrumentIcon'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import PracticeBarChart from '@/components/charts/PracticeBarChart'
import CategoryPieChart from '@/components/charts/CategoryPieChart'
import PracticeHeatmap from '@/components/charts/PracticeHeatmap'
import StatCard from '@/components/common/StatCard'
import type { PracticeSession, TeacherNote, Assignment, InstrumentType, Recording, PracticeCategory } from '@/types'

const CATEGORY_OPTIONS: PracticeCategory[] = [
  'Scales', 'Technique', 'Sight Reading', 'Repertoire', 'Memorization', 'Ear Training', 'Improvisation',
]

const NO_SESSIONS: PracticeSession[] = []

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { students, studentSessions, setStudentSessions } = useTeacherStore()
  const [notes, setNotes] = useState<TeacherNote[]>([])
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [assignTitle, setAssignTitle] = useState('')
  const [assignDesc, setAssignDesc] = useState('')
  const [assignDue, setAssignDue] = useState('')
  const [assignNeedsRecording, setAssignNeedsRecording] = useState(false)
  const [assignDailyMinutes, setAssignDailyMinutes] = useState('')
  const [assignKind, setAssignKind] = useState<'task' | 'daily'>('task')
  const [assignCategory, setAssignCategory] = useState('')
  // The form is a thing you occasionally do, not a thing you always look
  // at. Open by default it pushed the actual student data below the fold
  // every time you came here just to see how someone is getting on.
  const [composing, setComposing] = useState(false)
  const [reviewing, setReviewing] = useState<Assignment | null>(null)
  const [studentRecordings, setStudentRecordings] = useState<Recording[]>([])
  /** Null while the summary is still being fetched; false once we know. */
  const [summaryExists, setSummaryExists] = useState<boolean | null>(null)
  const [assigning, setAssigning] = useState(false)

  const student = students.find((s) => s.uid === studentId)
  // A fresh `[]` literal here is a new identity every render, which defeated
  // the four useMemos below — every chart recomputed over the full session
  // history on each keystroke in the assignment form.
  const sessions: PracticeSession[] = studentSessions[studentId ?? ''] ?? NO_SESSIONS
  const theme = getTheme(student?.instrument as InstrumentType | undefined)

  useEffect(() => {
    if (!studentId) return
    // The rolled-up copy, not the sessions themselves — see useTeacherData.
    const unsubSummary = subscribePracticeSummary(studentId, (summary) => {
      setSummaryExists(!!summary)
      setStudentSessions(studentId, sessionsFromSummary(summary))
    })
    const unsub = subscribeTeacherNotes(studentId, setNotes)
    const unsubA = profile?.uid
      ? subscribeTeacherStudentAssignments(profile.uid, studentId, setAssignments)
      : undefined
    return () => { unsubSummary(); unsub(); unsubA?.() }
  }, [studentId, setStudentSessions, profile?.uid])

  // Fetched only while a submission is actually open — a teacher browsing
  // a student has no need to hold their audio in memory.
  useEffect(() => {
    if (!reviewing) { setStudentRecordings([]); return }
    return subscribeSharedRecordings(reviewing.studentId, setStudentRecordings)
  }, [reviewing])

  const summary = useMemo(() => getAnalyticsSummary(sessions, student?.weeklyGoalMinutes ?? 300), [sessions, student])
  const dailyData = useMemo(() => getDailyData(sessions, 14), [sessions])
  const categoryData = useMemo(() => getCategoryData(sessions), [sessions])
  const heatmap = useMemo(() => getHeatmapData(sessions), [sessions])

  async function handleAssign() {
    if (!profile || !studentId || !assignTitle.trim()) return
    setAssigning(true)
    try {
      await createAssignment(profile.uid, studentId, {
        title: assignTitle.trim(),
        description: assignDesc.trim() || undefined,
        dueDate: assignDue || undefined,
        type: assignKind,
        // Each kind carries only its own fields, so a task cannot acquire a
        // stray daily target and a daily one cannot demand a recording.
        requiresRecording: assignKind === 'task' && assignNeedsRecording ? true : undefined,
        dailyTargetMinutes: assignKind === 'daily' && Number(assignDailyMinutes) > 0
          ? Number(assignDailyMinutes) : undefined,
        category: assignKind === 'daily' && assignCategory
          ? (assignCategory as PracticeCategory) : undefined,
      })
      setAssignTitle('')
      setAssignDesc('')
      setAssignDue('')
      setAssignNeedsRecording(false)
      setAssignDailyMinutes('')
      setAssignCategory('')
      setAssignKind('task')
      setComposing(false)
    } finally {
      setAssigning(false)
    }
  }

  async function addNote() {
    if (!profile || !studentId || !newNote.trim()) return
    setSaving(true)
    try {
      await addTeacherNote(profile.uid, studentId, newNote.trim())
      setNewNote('')
    } finally {
      setSaving(false)
    }
  }

  if (!student) return (
    <div className="flex items-center justify-center h-64 text-[var(--clay-dim)]">Student not found</div>
  )

  return (
    <div>
      <button onClick={() => navigate('/teacher/students')} className="flex items-center gap-2 text-[var(--clay-dim)] hover:text-[var(--clay-ink)] text-sm mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Students
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: `linear-gradient(135deg, ${theme.primary}40, ${theme.secondary}20)` }}>
          <InstrumentIcon instrument={student?.instrument as InstrumentType | undefined} size={26} style={{ color: theme.primary }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--clay-ink)]">{student.displayName}</h1>
          <p className="text-[var(--clay-dim)] text-sm capitalize">{student.instrument} · {student.experienceLevel}</p>
        </div>
      </div>

      {/* An empty page used to be ambiguous: a student who has not
          practised looked identical to figures that were never written.
          Say which. */}
      {summaryExists === false && (
        <Card className="mb-6 p-5">
          <p className="text-sm font-semibold" style={{ color: 'var(--clay-ink)' }}>
            No practice figures for {student?.displayName ?? 'this student'} yet
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--clay-dim)' }}>
            Their practice is recorded on their own device, and a summary of it is
            published for you the next time they open the app. If they have been
            practising and this stays empty, the <code>practiceSummary</code> and{' '}
            <code>studioStats</code> rules have most likely not been published yet —
            their app would be refused permission to share the figures.
          </p>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="This Week" value={`${summary.totalMinutesThisWeek}m`} delay={0} />
        <StatCard label="Streak" value={`${summary.currentStreak}d`} delay={0.05} />
        <StatCard label="Consistency" value={`${summary.consistencyScore}%`} delay={0.1} />
        <StatCard label="Goal" value={`${summary.weeklyGoalPercentage}%`} delay={0.15} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Card className="p-5">
          <p className="text-xs font-semibold text-[var(--clay-dim)] uppercase tracking-widest mb-4">Last 14 Days</p>
          <PracticeBarChart data={dailyData} color={theme.primary} />
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-[var(--clay-dim)] uppercase tracking-widest mb-4">Category Distribution</p>
          <CategoryPieChart data={categoryData} />
        </Card>
      </div>

      <Card className="p-5 mb-8">
        <p className="text-xs font-semibold text-[var(--clay-dim)] uppercase tracking-widest mb-4">Practice Heatmap</p>
        <PracticeHeatmap data={heatmap} color={theme.primary} />
      </Card>

      {/* Assignments */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-[var(--clay-dim)] uppercase tracking-widest flex items-center gap-2">
            <Sticker name="clipboard" size={14} tone="ink" /> Assignments
          </p>
          <button
            onClick={() => setComposing((v) => !v)}
            className="shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-transform active:scale-95"
            style={{
              background: composing ? 'var(--clay-bg)' : 'var(--clay-accent)',
              color: composing ? 'var(--clay-dim)' : 'var(--clay-on-accent)',
            }}
          >
            {composing ? 'Cancel' : '+ New assignment'}
          </button>
        </div>

        {composing && (
        <Card className="p-5 mb-4">
          <div className="space-y-3">

            {/* Two genuinely different things. A one-off task is handed in
                and reviewed; daily practice measures itself off the log and
                needs no review at all, so they ask for different fields. */}
            <div className="flex gap-2">
              {([
                { id: 'task', label: 'Task', hint: 'handed in once' },
                { id: 'daily', label: 'Daily practice', hint: 'minutes every day' },
              ] as const).map((k) => {
                const on = assignKind === k.id
                return (
                  <button
                    key={k.id}
                    onClick={() => setAssignKind(k.id)}
                    className="flex-1 px-3 py-2.5 text-left transition-colors"
                    style={{
                      borderRadius: 'var(--clay-r-sm)',
                      background: on ? 'var(--clay-accent)' : 'var(--clay-bg)',
                      color: on ? 'var(--clay-on-accent)' : 'var(--clay-dim)',
                    }}
                  >
                    <span className="block text-[13px] font-semibold">{k.label}</span>
                    <span className="block text-[11px] opacity-80">{k.hint}</span>
                  </button>
                )
              })}
            </div>

            <Input
              placeholder={assignKind === 'daily'
                ? 'Title (e.g. Daily scales)'
                : 'Assignment title (e.g. Practice Hanon No. 1)'}
              value={assignTitle}
              onChange={(e) => setAssignTitle(e.target.value)}
            />
            <Textarea
              placeholder="Description or notes (optional)"
              value={assignDesc}
              onChange={(e) => setAssignDesc(e.target.value)}
              rows={2}
            />
            {assignKind === 'daily' && (
              <>
                {/* The app reads this off the practice log, so the student
                    reports nothing and you take nobody's word. A due date is
                    required because it is the window being measured. */}
                <div className="flex items-center gap-2.5">
                  <Input
                    type="number"
                    min={1}
                    placeholder="Minutes per day"
                    value={assignDailyMinutes}
                    onChange={(e) => setAssignDailyMinutes(e.target.value)}
                    className="max-w-[180px]"
                  />
                  {!assignDue && (
                    <span className="text-[11.5px]" style={{ color: 'var(--clay-danger)' }}>
                      Set an end date below
                    </span>
                  )}
                </div>

                {/* Narrowing to one category is optional, and safe only
                    because the student's session is pre-filled with it when
                    they start from the assignment, and they are asked before
                    saving if it still does not match. Without both of those
                    this would silently fail to count. */}
                <Select
                  value={assignCategory}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAssignCategory(e.target.value)}
                  options={[
                    { value: '', label: 'Any kind of practice' },
                    ...CATEGORY_OPTIONS.map((c) => ({ value: c, label: `Only ${c}` })),
                  ]}
                />
              </>
            )}

            {/* Task only: a daily-practice assignment measures itself and is
                not handed in, so there is nothing for a recording to attach
                to. Off by default, since requiring audio makes scales,
                sight-reading and theory awkward to set. */}
            {assignKind === 'task' && (
            <button
              type="button"
              role="switch"
              aria-checked={assignNeedsRecording}
              onClick={() => setAssignNeedsRecording((v) => !v)}
              className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left"
              style={{ background: 'var(--clay-bg)' }}
            >
              <span
                className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
                style={{ background: assignNeedsRecording ? 'var(--clay-accent)' : 'var(--clay-bg-deep)' }}
              >
                <span
                  className="absolute top-0.5 h-4 w-4 rounded-full transition-all"
                  style={{ left: assignNeedsRecording ? 20 : 2, background: '#fff' }}
                />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
                  Require a recording
                </span>
                <span className="block text-[11.5px]" style={{ color: 'var(--clay-dim)' }}>
                  {assignNeedsRecording
                    ? 'They must attach a take before they can hand this in'
                    : 'They can hand it in with just a note'}
                </span>
              </span>
            </button>
            )}

            <div className="flex items-center gap-3">
              <Input
                type="date"
                value={assignDue}
                onChange={(e) => setAssignDue(e.target.value)}
                className="max-w-[180px]"
              />
              <Button size="sm" onClick={handleAssign} loading={assigning} disabled={!assignTitle.trim()}>
                <Plus size={14} /> Assign
              </Button>
            </div>
          </div>
        </Card>
        )}
        <div className="space-y-2">
          {assignments
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((a) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold text-sm ${normaliseStatus(a.status) === 'approved' ? 'line-through text-[var(--clay-dim)]' : 'text-[var(--clay-ink)]'}`}>
                        {a.title}
                      </p>
                      {(() => {
                        const st = normaliseStatus(a.status)
                        const label = st === 'approved' ? 'approved'
                          : st === 'submitted' ? 'handed in'
                          : st === 'returned' ? 'sent back'
                          : st === 'cancelled' ? 'cancelled' : 'assigned'
                        const variant = st === 'approved' ? 'success'
                          : st === 'submitted' ? 'warning' : 'info'
                        return <Badge variant={variant} size="sm">{label}</Badge>
                      })()}
                      {a.requiresRecording && (
                        <Badge variant="default" size="sm">recording</Badge>
                      )}
                    </div>
                    {a.description && <p className="text-xs text-[var(--clay-dim)] mt-1">{a.description}</p>}
                    {/* Progress without having to open anything: the point
                        of a minutes-a-day assignment is that it answers
                        itself from the practice log. */}
                    {(() => {
                      const daily = deriveDailyProgress(a, sessions)
                      if (daily.tracked) return (
                        <div className="mt-2">
                          <DailyStrip progress={daily} dailyTarget={a.dailyTargetMinutes ?? 0} compact />
                          <p className="text-xs mt-1.5" style={{ color: daily.onTrack ? 'var(--clay-dim)' : 'var(--clay-danger)' }}>
                            {daily.minutesDone} / {daily.minutesRequired} min
                            {' · '}{daily.daysMet} of {daily.daysRequired} days
                            {!daily.onTrack && ' · missed a day'}
                          </p>
                        </div>
                      )
                      const total = deriveProgress(a, sessions)
                      if (total.tracked) return (
                        <p className="text-xs mt-1.5" style={{ color: 'var(--clay-dim)' }}>
                          {total.minutesDone} / {a.targetMinutes} min practised
                          {total.targetMet && ' · target met'}
                        </p>
                      )
                      return null
                    })()}
                    <p className="text-xs text-[var(--clay-dim)] mt-1">
                      Assigned {format(parseISO(a.createdAt), 'MMM d')}
                      {a.dueDate ? ` · Due ${format(parseISO(a.dueDate), 'MMM d')}` : ''}
                      {a.completedAt ? ` · Completed ${format(parseISO(a.completedAt), 'MMM d')}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {needsReview(a) && (
                      <button
                        onClick={() => setReviewing(a)}
                        className="rounded-full px-3 py-1.5 text-[12px] font-semibold transition-transform active:scale-95"
                        style={{ background: 'var(--clay-accent)', color: 'var(--clay-on-accent)' }}
                      >
                        Review
                      </button>
                    )}
                    <button onClick={() => deleteAssignment(a.id)} className="text-[var(--clay-dim)] hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Card>
              </motion.div>
            ))}
          {assignments.length === 0 && (
            <p className="text-sm text-[var(--clay-dim)] text-center py-4">No assignments yet.</p>
          )}
        </div>
      </div>

      {/* Teacher notes */}
      <div>
        <p className="text-xs font-semibold text-[var(--clay-dim)] uppercase tracking-widest mb-4 flex items-center gap-2">
          <Sticker name="message" size={14} tone="ink" /> Teacher Notes
        </p>
        <Card className="p-5 mb-4">
          <Textarea
            placeholder="Leave a note for this student..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
          />
          <Button size="sm" className="mt-3" onClick={addNote} loading={saving} disabled={!newNote.trim()}>
            <Plus size={14} /> Add Note
          </Button>
        </Card>
        <div className="space-y-3">
          {notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((note) => (
            <motion.div key={note.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-slate-200">{note.content}</p>
                    <p className="text-xs text-[var(--clay-dim)] mt-2">{format(parseISO(note.createdAt), 'MMMM d, yyyy · h:mm a')}</p>
                  </div>
                  <button onClick={() => deleteTeacherNote(note.id)} className="text-[var(--clay-dim)] hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <ReviewSheet
        assignment={reviewing}
        studentName={student?.displayName ?? 'Student'}
        recordings={studentRecordings}
        open={!!reviewing}
        onClose={() => setReviewing(null)}
      />

    </div>
  )
}
