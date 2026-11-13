# Teacher studio — build plan

Status: plan only. Nothing here is built yet. The demo it follows is the
"MaestroTrack Teacher Studio demo" canvas (desktop board + phone board).

Ground rules for the whole build (from you, carried over):

- Existing security rules are not changed. Every rules change below is an
  **addition** (new `match` blocks, or a new `allow` beside an old one), with
  tests, and you deploy rules yourself.
- Student-side features keep working exactly as they do now. Where the
  student app has to change (approving a correction, seeing teacher-added
  practice), it is additive and behind data that only exists once a teacher
  uses the feature.
- No production data is touched. All testing runs on `dev:emulator`.
- Nothing is committed or pushed until you say "push".

---

## 1. What the demo settled

| Area | Decision |
|---|---|
| Look | The student app's tokens (`--clay-*`), lilac ground, white surfaces, orange accent. Pages are **one connected sheet** with hairline dividers, not floating cards. |
| Desktop navigation | A 72 px icon rail on every page; it opens to 248 px **over** the page while hovered or focused, and closes when the pointer leaves. |
| Phone navigation | Bottom tabs: Today · Calendar · Students · Review · More. Messages from the header icon. Pushed screens get a back button; editing happens in bottom sheets. |
| Adding students | The current invite (QR + read-out code, Copy link, Send, 7 days, one student) and the current Accept/Decline list, plus a new "Add without an account". |
| Messages | A docked panel bottom-right (list → thread), opened from the dock button or any student's message button. |
| Calendar | Week view: drag to move (15-minute snap, across days), drag the bottom edge to resize, click to open. After a drag: "this week only", with an **Every week** button. Month view: Apple-Calendar style, coloured bar + title per item, "+N more". No open slots. |
| Tags | Editable name and colour (8 swatches), add/delete (delete only when unused). Event colour comes from its tag. |
| To review | A list (not cards) of handed-in assignments: status filter with counts, type filter, sort, multi-select with Approve / Send back / Message. Inline review row with player, feedback and next step. |
| Families | Filter (All / Unpaid / Overdue / Paid with counts), sort (balance / name / due date), multi-select with reminder / email invoices / mark paid / export. |
| Settings | One panel, label column + controls. Default lesson length. Lesson types with **editable prices**. List of students with their own length or price, each with "Use defaults". |
| Lengths and prices | Three levels, each overriding the one above: studio default → student's own → a single lesson. |

---

## 2. The one structural change: a studio roster

Today a "student" is a `users` document with `teacherId`. A student without
an account has no such document, and every teacher-side rule uses
`teaches(studentId)`, which reads `users/{studentId}`. So students without
accounts need their own record.

**New collection `studioStudents/{rosterId}`** — one per student the teacher
teaches, with or without an account. Owned by the teacher.

- A student who joins through the existing invite → accept flow gets a
  roster row created at accept time with `uid` set.
- A student added without an account gets a roster row with `uid: null`.
- When that student later accepts an invite, the roster row's `uid` is
  filled in and everything keyed by `rosterId` is already theirs.
- Existing students (accepted before this ships) get a roster row lazily:
  the first time the teacher app sees a `users` student with no roster row,
  it creates one. No migration script, no production write from a tool.

Everything new and teacher-owned (lessons, attendance, notes, invoices,
families) is keyed by `rosterId` + `teacherId`. Things the **student** must
read (shared notes, assignments, messages) keep using the student's `uid`,
exactly as now, and simply don't exist for a student without an account
(for them, the teacher's copy is all there is; email covers the family).

---

## 3. Data model (new types in `src/types/index.ts`)

```ts
/** Teacher-owned. One per student, account or not. */
interface RosterStudent {
  id: string
  teacherId: string
  uid: string | null              // set once they have an account and are accepted
  name: string
  instrument?: InstrumentType
  familyId?: string
  lessonMinutes?: number | null   // null/absent = studio default
  priceCents?: number | null      // null/absent = the lesson type's price for that length
  makeupCredits: number
  status: 'active' | 'paused' | 'left'
  invitedAt?: string              // last "Invite to the app" for an offline student
  createdAt: string; updatedAt: string
}

interface Family {
  id: string; teacherId: string
  name: string                    // "Reyes family"
  contacts: { name: string; email?: string; phone?: string }[]
  createdAt: string; updatedAt: string
}

/** Studio-wide settings: one doc per teacher, id = teacherId. */
interface StudioSettings {
  teacherId: string
  defaultLessonMinutes: number     // 30
  lessonTypes: { id: string; name: string; minutes: number; priceCents: number; group?: boolean }[]
  tags: { id: string; name: string; color: string }[]   // calendar tags
  policy: { teacherCancelCredit: boolean; noticeCredit: boolean; noticeHours: number; creditExpiryDays: number | null }
  studentSees: { sharedNotes: boolean; attendance: boolean; reports: boolean }
  currency: 'USD'                  // see open decisions
  updatedAt: string
}

/** A weekly lesson or class: the "every week" thing. */
interface LessonSeries {
  id: string; teacherId: string
  rosterIds: string[]              // one = private, several = group
  title?: string                   // groups / events
  tagId: string
  dayOfWeek: 0|1|2|3|4|5|6
  startTime: 'HH:mm'
  minutes?: number | null          // absent = follows the student's / studio default
  where: string; onlineLink?: string
  startsOn: 'yyyy-MM-dd'; endsOn?: 'yyyy-MM-dd'
  createdAt: string; updatedAt: string
}

/** One dated lesson. Created when something happens to it (moved,
 *  resized, attended, noted) or when it is a one-off. Otherwise a week's
 *  lessons are generated from the series and never stored. */
interface LessonOccurrence {
  id: string                       // `${seriesId}_${date}` for series lessons, random for one-offs
  teacherId: string
  seriesId?: string
  rosterIds: string[]
  date: 'yyyy-MM-dd'; startTime: 'HH:mm'; minutes: number
  tagId: string; title?: string; where: string
  attendance?: Record<string /*rosterId*/, 'present'|'student_cancel'|'teacher_cancel'|'missed'>
  makeupFor?: string               // occurrence id this makes up
  carried?: { text: string; state: 'open'|'covered'|'carried' }[]
  createdAt: string; updatedAt: string
}

/** Notes split by who may read them. */
interface LessonNote {             // existing collection teacherNotes, extended
  // + occurrenceId?: string, shared: true   (students can read: unchanged rule)
}
interface PrivateNote {            // NEW collection, teacher-only
  id: string; teacherId: string; rosterId: string; occurrenceId?: string
  content: string; createdAt: string; updatedAt: string
}

interface Invoice {
  id: string; teacherId: string; familyId: string
  period: 'yyyy-MM'
  lines: { rosterId: string; text: string; amountCents: number; occurrenceIds: string[] }[]
  totalCents: number; paidCents: number
  status: 'draft'|'sent'|'paid'|'void'
  dueOn: 'yyyy-MM-dd'; sentAt?: string; remindedAt?: string[]
  payments: { at: string; amountCents: number; method: 'cash'|'card'|'transfer'|'other'; note?: string }[]
  createdAt: string; updatedAt: string
}

/** Teacher suggests; the student decides. */
interface PracticeCorrection {
  id: string; teacherId: string; studentId: string   // uid — only for students on the app
  sessionId: string; fromMinutes: number; toMinutes: number; reason?: string
  status: 'pending'|'accepted'|'declined'
  createdAt: string; decidedAt?: string
}

/** Practice the teacher records for a student ("I practised 30 min Tuesday"). */
interface TeacherPracticeEntry {
  id: string; teacherId: string; rosterId: string; studentId?: string
  date: 'yyyy-MM-dd'; minutes: number; what?: string
  createdAt: string
}

/** Last-read marks for the messages dock (messages themselves are immutable). */
interface ThreadRead { id: `${teacherId}_${studentId}`; teacherId: string; studentId: string; teacherReadAt?: string; studentReadAt?: string }
```

Extensions to existing types (all optional, so old documents still read):

- `Assignment`: `rosterId?`, `attachments?: { kind: 'audio'|'video'|'pdf'|'image'; storagePath: string; name: string }[]`, `templateId?`.
- `PracticeSummary`: `recentSessions?: { id; date; minutes; category?; pieceName? }[]` (last 30, written by the student's own summary sync; **no notes, no thoughts pad**). This is what the teacher's practice log and "Suggest a correction" read, so the teacher still never reads a session document.
- `LessonSlot` stays as is and keeps working. The calendar reads both; the first time a teacher edits a slot it is copied into a `LessonSeries` and the slot is left alone (see §7.3).

---

## 4. Firestore rules — additions only

Each new collection gets its own `match` block. Nothing existing is edited.

| Collection | Read | Write |
|---|---|---|
| `studioStudents` | `teacherId == uid()`; a student may `get` the row whose `uid == uid()` | teacher only; `teacherId` immutable; `uid` may go from `null` to a value **only** when a pending `studioRequests` doc from that uid to this teacher exists (same check the accept rule uses today) |
| `families` | teacher | teacher; `teacherId` immutable |
| `studioSettings/{teacherId}` | teacher; students of that teacher may read (for tag colours / their own lesson length) | doc id must equal `uid()` |
| `lessonSeries`, `lessonOccurrences` | teacher; a student may read docs whose `rosterIds` contain their roster id — done by also storing `studentUids: string[]` on the doc and checking `uid() in resource.data.studentUids` | teacher; `teacherId` immutable; every `rosterIds` entry must be a roster row this teacher owns (checked with `get()` on up to 10 ids — groups capped at 10 in the UI) |
| `privateNotes` | teacher only — **never** the student (this is the point of the collection) | teacher |
| `invoices` | teacher | teacher; status/amount changes free for the teacher |
| `practiceCorrections` | teacher who wrote it; the student it is for | create: teacher, `teaches(studentId)`; update: student only, only `status`/`decidedAt`, only from `pending` |
| `teacherPractice` | teacher; student (by `studentId`) | teacher; `teaches(studentId)` when `studentId` is set |
| `threadReads` | either side of the id | each side may only set its own `…ReadAt` field |
| `assignments` (existing) | unchanged | **one added `allow create`**: `studentId == null && rosterId` points to a roster row this teacher owns with `uid == null` (assignments for students without an account). Plus one added `allow update` that only fills `studentId` from null to the roster row's `uid`. The two existing rules stay byte-for-byte. |

Storage: one new path `studio/{teacherId}/attachments/{fileId}` — teacher
writes (size/type limits like recordings), and a student reads only through
the assignment that names it (signed URL from a small API route, the same way
private recordings play today).

Tests: a new `rules.studio.test.ts` with the usual allow/deny pairs for each
row above, plus attack cases (another teacher, a student editing a correction's
minutes, a student reading `privateNotes`, filling `uid` without a request).
Added to `test:rules`. The existing 373 rules tests must stay green unchanged.

---

## 5. Server routes (Vercel, `api/`)

Uses the existing `api/_lib/admin.js` (firebase-admin, `FIREBASE_SERVICE_ACCOUNT`).

- `api/studio/email.js` — sends to families without the app: message copies,
  announcements, invoices, payment reminders. Verifies the caller's ID token
  and that the family belongs to that teacher. **Needs an email provider and
  its key in Vercel env** (see open decisions). Until then the buttons say
  "Copy email" and open the teacher's own mail app with the text filled in.
- `api/studio/attachment.js` — short-lived URL for an assignment attachment,
  after checking the caller is that student or teacher.
- Accepting a join request already runs client-side under the rules; linking
  the roster row (`uid` from null) is added to that same accept path, so no
  server change is needed for it.

---

## 6. App structure

### 6.1 Layout

- `src/components/layout/TeacherRail.tsx` (new): the 72/248 px hover rail.
  `onPointerEnter/Leave` + `onFocus/onBlur` (focus-within) on the `<aside>`;
  the wide panel is `position: absolute` so the page never reflows. Reduced
  motion: no width transition. `AppLayout` picks `TeacherRail` for
  `role === 'teacher'` on desktop; the student `Sidebar` is untouched.
- `src/components/layout/Sheet.tsx` (new): the connected white sheet with
  header slot (title, subtitle, actions) used by every teacher page.
- Phone: `BottomTabs` gets a `teacherTabs` list in `nav.ts`
  (Today, Calendar, Students, Review, More). `teacherNav` (desktop) becomes
  Dashboard, Students, Calendar & Attendance, To review, Families & Invoices,
  Reports, Settings. Research moves under Reports.
- `src/components/teacher/MessageDock.tsx` (new): mounted once in the
  teacher layout; state in a small zustand slice (`dockOpen`, `threadId`), so
  any page can call `openThread(studentId)`.

### 6.2 Routes (`App.tsx`, all through `lazyPage`)

```
/teacher                      Dashboard
/teacher/students             Students (+ waiting to join)
/teacher/students/:rosterId   Student record (tabs in the URL: ?tab=practice)
/teacher/calendar             Calendar (?view=week|month&date=2026-11-09)
/teacher/review               To review
/teacher/families             Families & Invoices (?family=…)
/teacher/reports              Reports (Research lives here)
/teacher/settings             Settings (one panel)
/teacher/messages             Phone only: full-screen list → thread
```

Old paths (`/teacher/schedule`, `/teacher/research`) redirect.

### 6.3 Data loading

- `useTeacherData` gains subscriptions for `studioStudents`, `families`,
  `studioSettings`, `lessonSeries`, this month's `lessonOccurrences`,
  `invoices` (open + this month), `threadReads`. All via `onServerSnapshot`.
- `teacherStore` + `TeacherSnapshot` gain the same keys, so the saved copy in
  IndexedDB makes every page open instantly (bump the snapshot `VERSION`).
- `src/lib/studio/` (new, pure functions, unit-tested):
  - `lengths.ts` — `lessonMinutes(roster, settings)`, `lessonPrice(roster, settings)`, `isCustom…`.
  - `calendar.ts` — `weekOf(date, series, occurrences, tz)` and `monthOf(...)`: expands series into dated lessons, applies occurrence overrides, holidays/closures.
  - `drag.ts` — snap/clamp maths shared by desktop and phone.
  - `invoices.ts` — `draftInvoice(family, month, occurrences, roster, settings)` from **attended** lessons and policy (teacher-cancel credit lines at $0, etc.).
  - `review.ts` — filter/sort/select for the To review list.

---

## 7. Feature by feature

### 7.1 Dashboard
Stats strip (lessons today, to review, studio practice, outstanding),
today's lessons with inline attendance, needs attention (reviews, make-ups to
book, overdue, gone quiet, unread questions), recent practice, due this week,
recent notes. All derived from the store — no new reads.

### 7.2 Students and the record
- List: search, filter (on the app / not), columns incl. **length** (with an
  "Own length" chip) and **price**. Message button per row → dock.
- "+ Add student": tabs **Invite to the app** (reuses `InviteSheet` as is) and
  **Add without an account** (creates a roster row + optional family).
- Waiting to join: reuses `PendingRequests` as is; accepting also creates /
  links the roster row.
- Record tabs: Overview (contact, family, siblings, **weekly lesson: length
  select with "Studio default (30 min)" + price field with the default as
  placeholder**, make-up credits ±), Lessons & notes, Assignments, Repertoire,
  Practice, Recordings, Report. `StudentDetailPage.tsx` is rebuilt on the new
  sheet; its existing panels are moved, not rewritten, where they still fit.

### 7.3 Calendar (week + month), drag, resize, tags
- **Week view** (`CalendarWeek.tsx`): 8 AM–8 PM default, hours configurable.
  Lessons are buttons (keyboard opens them); pointer handlers:
  - `pointerdown` on the block → capture pointer, record start; on move,
    `drag.ts` turns Δy into 15-minute steps and Δx into a day column (column
    rects read once at drag start); the block renders at the preview spot.
  - `pointerdown` on the bottom 10 px handle → same, but changes length.
  - `pointerup` → write the **occurrence** for that date (`${seriesId}_${date}`)
    with the new date/time/length. Toast: "… — this week only" with
    **Every week**, which instead updates the series (or, for a private
    lesson's length, the student's `lessonMinutes`) from that date on.
  - Click after a drag is swallowed (400 ms guard), so a drag never opens it.
  - Phone (`CalendarDay.tsx`): same maths, vertical only, started by a
    **long-press** (300 ms) so normal scrolling still works.
- **Month view** (`CalendarMonth.tsx`): 6×7 grid, today in an orange circle,
  per item a 3 px tag-colour bar + title, all-day items as tinted pills,
  max 3 then "+N more"; clicking a day opens that week. Phone: dots per day +
  the selected day's list underneath.
- **Tags**: stored in `studioSettings.tags`; side panel (desktop) / sheet
  (phone) to rename, recolour (8 swatches, all ≥3:1 against white), add,
  delete when unused. Default tags: Private lesson, Group class, Make-up,
  Recital or event, Cancelled.
- **Lesson window**: start time, length (shows "This lesson only: 45 min.
  Usual 30, studio default 30"), tag, attendance, carried topics, shared
  note, private note, "Turn into an assignment", attachments.
- **Make-ups**: credits from policy; "Make-ups to book" lists students with
  credits and the teacher's free times (gaps between lessons that fit the
  student's length) — offered as choices, not drawn as open slots.
- Existing `LessonSlot`s show in the calendar as series; editing one copies
  it into `lessonSeries` (the slot is kept so the student's current "next
  lesson" view keeps working until the student app reads series too).

### 7.4 Attendance and make-ups
Attendance on the occurrence (per roster id for groups). Policy decides the
credit: teacher cancel → credit; student cancel with ≥ `noticeHours` →
credit; missed → none. Credits expire per policy (computed, not a job).
Booking a make-up uses a credit and creates a one-off occurrence with
`makeupFor`.

### 7.5 Lesson notes
Shared notes → existing `teacherNotes` (students already read these; rule
unchanged) with `occurrenceId`. Private notes → new `privateNotes`. Carried
topics live on the occurrence and pre-fill the next one.

### 7.6 Assignments, attachments, templates
Existing assignment model and student hand-in flow unchanged. Added:
attachments (upload to the new storage path), "Copy to another student",
"Save as template" (templates in `studioSettings` or a small
`assignmentTemplates` collection), assignments for students without an
account (`rosterId`, `studentId: null`; linked on join).

### 7.7 To review (replaces "Recordings to review")
`ReviewPage.tsx`: rows = assignments with `status: 'submitted'` (plus
returned/approved for the other filters), joined with their latest
submission and recordings.
- Filters: Needs review · Sent back · Approved · All (counts); Type:
  everything / recordings / checked off; Sort: newest, waiting longest, due
  date, student A–Z.
- Multi-select: header checkbox selects all shown; bulk Approve / Send back
  run as one `writeBatch` (chunks of 450), each appending to `feedback` the
  same way the single review does today — through the teacher `allow update`
  that already exists. Bulk Message opens the dock.
- Row expands inline: player (private recordings via the existing
  `recordingAudio`), feedback, next step, Approve / Send back.

### 7.8 Practice log, corrections, teacher-added practice
- Log = `practiceSummary.recentSessions` (student-written, no private text).
- "Suggest a correction" → `practiceCorrections` (pending). Student side:
  a card on Today/Studio: "Ms Harper suggests 20 min instead of 45 for
  Monday's Minuet — Accept / Decline". Accept updates **their own** session
  through the normal path (so league/streak rules apply as they already do)
  and marks the correction accepted.
- "Add practice for Ana" → `teacherPractice`. Shown in both logs as "added
  by your teacher". Counts toward the teacher's charts; **does not** count
  toward the league or streak (open decision below).

### 7.9 Recordings and feedback
Existing recordings + feedback flow; surfaced in the record's Recordings
tab and in To review.

### 7.10 Messages and notifications
- Dock (desktop) / full screen (phone) over the existing `messages`
  collection and `sendMessage` — no change to how a message is stored.
- Context chips attach `attachment: { kind: 'assignment', id }` (already in
  the rules); a lesson link is added as text (no rule change).
- Unread: `threadReads` (messages are immutable by rule, so read state can't
  live on them).
- Students without the app: the thread shows "goes to the family by email"
  and sends through `api/studio/email.js`.
- Announcement: one message per student on the app + one email per family
  without it.

### 7.11 Progress reports
Built from occurrences (attendance), summary (practice), assignments,
repertoire changes, plus the teacher's paragraph. Share uses the existing
share-link system (`shares/`), print uses a print stylesheet.

### 7.12 Billing and families
- Families: filters/sort/multi-select as in the demo.
- Invoices drafted monthly from attended lessons × each student's price
  (§2 levels), credits as $0 lines; teacher reviews → Send (email) →
  Record payment (manual: cash/card/transfer). Balances and overdue are
  computed from invoices.
- Export: CSV of the selected families' invoices.
- No online card payments in this build (see open decisions).

### 7.13 Teacher account and studio settings
`TeacherSettingsPage.tsx` becomes the one-panel layout: Studio (name,
instruments), **Lessons and prices** (default length; lesson types with
editable name / length / price; add/remove; students with their own length
or price + "Use defaults"), Cancellations and make-ups, What students see,
Teachers (invite — later), plus the existing account items (profile, sign
out, export data) moved in as sections. Changing the default length shows
"Students with their own length keep it".

---

## 8. Phone UI

- Tabs: Today · Calendar · Students · Review · More (Families, Messages,
  Reports, Add a student, Settings).
- Grouped white lists on the lilac ground, 44 px+ targets, large titles on
  root screens, small titles + back on pushed screens.
- Calendar: week strip + day timeline (long-press drag, bottom-edge
  resize), Month with dots and the selected day's list, Tags sheet.
- Review and Families: **Select** in the header turns rows into checkboxes;
  a dark action bar appears above the tab bar (Approve / Send back; Mark
  paid / Remind).
- Lesson, review and tag editing in bottom sheets.

---

## 9. Speed

Every new page through `lazyPage`; every list through `onServerSnapshot`;
everything the pages read is in the teacher snapshot, so opening any
teacher page shows the last-known data immediately and updates live. Month
view expands series in memory — no per-day queries. Occurrences are
queried by month (`teacherId` + `date` range; one composite index).

---

## 10. Build order (one branch, one push when you say so)

1. Types + `src/lib/studio/*` pure functions + unit tests.
2. Rules additions + `rules.studio.test.ts` (you deploy).
3. Store, snapshot, `useTeacherData` subscriptions.
4. Layout: `TeacherRail`, `Sheet`, phone tabs, routes + redirects.
5. Students, roster, families, add-without-account, linking on accept.
6. Calendar: series/occurrences, week drag/resize, month, tags, lesson window, attendance, make-ups.
7. Notes (shared/private), carried topics.
8. Assignments additions + To review.
9. Message dock + read marks + announcement.
10. Practice log, corrections (teacher + student card), teacher-added practice.
11. Settings one panel, prices, default length.
12. Invoices, payments, reminders, export; email route.
13. Reports.
14. Phone pass over every screen.
15. Full run on the emulator (desktop + phone widths), `npm test`, `npm run test:rules`, `npm run build`, lint.

---

## 11. Open decisions (need your answer before the step that uses them)

1. **Email for families without the app** (step 12): which provider
   (Resend is the simplest), and you add its key to Vercel yourself. Until
   then: "Copy email" / open your mail app.
2. **Teacher-added practice**: count toward the student's streak? (Plan:
   no, and never toward the league.)
3. **Currency and tax**: USD only, no tax lines? (Plan: yes for now.)
4. **Online payments** (Stripe): later, not in this build?
5. **"Every week"** from a drag: applies from that date forward only, never
   to past lessons. (Plan: yes.)
6. **Student sees their lesson length/price?** Plan: length yes (it's their
   lesson), price no (parents see invoices by email).
