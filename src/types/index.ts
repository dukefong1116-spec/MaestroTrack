export type UserRole = 'student' | 'teacher'

export type InstrumentType =
  | 'piano'
  | 'violin'
  | 'viola'
  | 'cello'
  | 'flute'
  | 'clarinet'
  | 'saxophone'
  | 'trumpet'
  | 'trombone'
  | 'percussion'
  | 'voice'
  | 'guitar'
  /** Anything the list above does not name. */
  | 'other'

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'professional'

/* ── display and alert preferences ─────────────────────────────── */
export type ThemeChoice = 'system' | 'light' | 'dark'
export type AccentName = 'instrument' | 'coral' | 'indigo' | 'teal' | 'amber' | 'rose' | 'slate'
/** Each maps to real NotificationKind values the builders emit — see
 *  notifications.ts. Nothing here is a switch wired to nothing. */
export type NotifyKind =
  /** assignment-new */
  | 'assignments'
  /** assignment-returned, assignment-approved */
  | 'feedback'
  /** lesson-tomorrow, lesson-soon */
  | 'lessons'
  /** submission-received — teachers only */
  | 'submissions'
  /** The prompts on Today, which are a separate surface from the bell. */
  | 'nudges'
  /** league-passed, league-last-day, league-results — students only */
  | 'league'

export type PracticeCategory =
  | 'Scales'
  | 'Technique'
  | 'Sight Reading'
  | 'Repertoire'
  | 'Memorization'
  | 'Ear Training'
  | 'Improvisation'

export type PerformanceType =
  | 'Competition'
  | 'Recital'
  | 'Audition'
  | 'Jury'
  | 'Masterclass'

export type TourCheckpoint = 'welcome' | 'today' | 'start' | 'streak' | 'history' | 'done'

export interface LeagueResult {
  week: string
  roomId: string
  fromTier: number
  toTier: number
  rank: number
  of: number
  xp: number
  maestro: boolean
  /** When the server wrote it — the week's end, as far as the bell knows. */
  at?: string
}

export interface LeagueState {
  tier?: number
  roomId?: string | null
  week?: string | null
  lastResult?: LeagueResult
}

export interface LeagueMember {
  name: string
  colour: number
  xp: number
  xpAt: string
  joinedAt: string
  passedBy?: { name: string; at: string }
}

export interface LeagueRoom {
  id: string
  week: string
  weekStart: string
  tier: number
  band: number
  endsAt: number
  status: 'open' | 'final'
  members: Record<string, LeagueMember>
}

/** One change to a student's streak rules; applies from `from` onward.
 *  `lessonDay`: Monday = 0 … Sunday = 6. `min` 0 means any practice. */
export interface StreakRuleEntry {
  from: string
  min: number
  lessonDay: number | null
}

export interface UserProfile {
  uid: string
  email: string
  role: UserRole
  displayName: string
  instrument?: InstrumentType
  experienceLevel?: ExperienceLevel
  weeklyGoalMinutes?: number
  dailyGoalMinutes?: number
  monthlyGoalMinutes?: number
  studioName?: string
  studioCode?: string
  teacherId?: string
  /** Written when a teacher accepts, so a student can be told whose
   *  studio they are in without reading the teacher's profile — which
   *  the rules do not permit. */
  teacherName?: string
  createdAt: string
  updatedAt: string
  reminderTime?: string
  reminderEnabled?: boolean
  theme?: ThemeChoice
  /** Set once somebody has actually used the Appearance screen. Absent
   *  means every preference below is a default the app wrote, not a
   *  choice the person made — see prefs.ts. */
  prefsVersion?: number
  /** Which colour the app wears. 'instrument' leaves it as the app ships. */
  accent?: AccentName
  /** Percent; 100 is the app's own sizing. */
  displayScale?: number
  reduceMotion?: boolean
  /** Which kinds of notification reach the bell. */
  notify?: Partial<Record<NotifyKind, boolean>>
  avatar?: string
  /** Dates (yyyy-MM-dd) rescued by a streak freeze. */
  streakFreezesUsed?: string[]
  /** Daily minimum and lesson day, as a history: each entry applies from
   *  its date on. See src/lib/streak/engine.js. */
  streakRules?: StreakRuleEntry[]
  /** Missed days a comeback brought back (yyyy-MM-dd). */
  streakRepaired?: string[]
  /** Badge ids whose unlock animation has already been shown. */
  badgesSeen?: string[]
  /** BadgeId → ISO date, written the first time a badge is seen as won.
   *  Absent for anything earned before this existed: that date is genuinely
   *  unknown, and a guessed one would read as fact. */
  badgeEarnedAt?: Record<string, string>
  /** BadgeIds shown on Today, in the order they were pinned. Capped at 3. */
  pinnedBadges?: string[]
  /** Set the first time the person pins or unpins anything themselves.
   *  The app fills the row for someone who never has, so that the feature
   *  is discovered; this is what stops it undoing their arrangement after. */
  badgePinsTouched?: boolean
  /** Piece ids already offered as "ready to call mastered?" — offered once each. */
  masteryPromptsSeen?: string[]
  /**
   * The first-run tour and the one-time intros after it. `dismissed`,
   * `completedAt` and `celebrated` are from the tour before this one and
   * are only ever read back as history now.
   */
  /** Student: messages from the teacher up to here have been read. */
  messagesReadAt?: string
  /**
   * Weekly league state — written only by the league server, never by the
   * app (the rules freeze it). See src/lib/league/rules.js.
   */
  league?: LeagueState
  /** The last league week whose result reveal has been watched. */
  leagueSeen?: string
  /** Settings → Privacy → Weekly leagues, switched off. */
  leagueOptOut?: boolean
  /** Teacher: per student, messages up to here have been read. */
  threadsReadAt?: Record<string, string>
  onboarding?: {
    dismissed?: boolean
    completedAt?: string
    /** Set once the "that's the tour" card has actually been shown. */
    celebrated?: boolean
    /** One-time intros already shown: 'library', 'progress', 'piece-prompt'. */
    seen?: string[]
    /**
     * Where a new student is in the first-run tour. Written at sign-up as
     * 'welcome', so only accounts made since the tour existed are ever
     * walked through it; 'done' when it is over. Only checkpoints are kept
     * here — the steps inside the first session live in memory, so a
     * reload mid-session falls back to "tap Start" rather than stranding
     * anyone. See lib/utils/tour.
     */
    tour?: TourCheckpoint
    /** Started again from Settings, so it can be skipped. */
    replay?: boolean
  }
  /**
   * Everything that became true before this has been seen.
   *
   * A watermark rather than a list of ids: notifications are derived, so
   * there is nothing to mark individually, and one timestamp cannot grow
   * without bound the way an ever-appended array would.
   */
  notificationsReadAt?: string
}

export interface PracticeSession {
  id: string
  userId: string
  date: string
  durationMinutes: number
  /** The category with the most minutes — the whole session, when there
   *  is only one. Kept on every session so everything that reads a single
   *  category still works unchanged. */
  category: PracticeCategory
  /**
   * Minutes per category, when a session covered more than one. Absent on
   * single-category sessions and on everything saved before this existed;
   * read it through minutesByCategory, which treats both the same. The
   * values always sum exactly to durationMinutes.
   */
  categoryMinutes?: Partial<Record<PracticeCategory, number>>
  /**
   * Minutes per piece (by piece id), when a session covered more than one.
   * `pieceName` still holds the main piece's id, so everything that reads
   * one piece works unchanged; read both through lib/utils/sessionPieces.
   */
  pieceMinutes?: Record<string, number>
  pieceName?: string
  difficultyRating: number
  confidenceRating: number
  notes?: string
  createdAt: string
  /**
   * Stamped by the practice timer, for the weekly league: only timer
   * sessions count there. Frozen once written (see the rules). Absent on
   * sessions typed into the Practice Log.
   */
  source?: 'timer'
  /** What the timer itself measured, in whole minutes. */
  timedMinutes?: number
  /** The league server's signed ticket from when the timer started. */
  ticket?: string
}

export interface Piece {
  id: string
  userId: string
  title: string
  composer?: string
  difficulty: number
  status: 'active' | 'archived' | 'mastered'
  totalMinutes: number
  sessionCount: number
  completionPercentage: number
  confidenceHistory: { date: string; value: number }[]
  startedAt: string
  updatedAt: string
  targetDate?: string
  notes?: string
}

export interface Recording {
  id: string
  userId: string
  pieceId?: string
  /**
   * What you called this take.
   *
   * Separate from pieceName, which means "what piece this was" and is
   * real data the Research page groups on. Overloading that field to
   * carry a nickname would corrupt it. Absent on every take made before
   * naming existed, hence optional and hence the fallback at display.
   */
  title?: string
  pieceName: string
  date: string
  /** Where the audio is in Storage. Every take saved since recordings
   *  became private; played through recordingAudio. */
  storagePath?: string
  /** A download URL, on takes saved before that. Plays for anyone who
   *  has it — kept only so those older takes still play. */
  audioUrl?: string
  notes?: string
  duration?: number
  createdAt: string
  /** Set when the clip was captured inside a practice session. */
  sessionId?: string
  /**
   * Set only when the take is attached to a submitted assignment. It is
   * what the security rules check, so practice takes stay private by
   * default and a teacher hears only what was handed to them.
   */
  sharedWithTeacher?: boolean
}

export interface Goal {
  id: string
  userId: string
  type: 'daily' | 'weekly' | 'monthly'
  targetMinutes: number
  period: string
  achievedMinutes: number
  completed: boolean
  completedAt?: string
  createdAt: string
}

export interface Performance {
  id: string
  userId: string
  eventName: string
  type: PerformanceType
  date: string
  location?: string
  pieces: string[]
  preparationPercentage: number
  notes?: string
  createdAt: string
}

/**
 * Something a message is about, shown as a card in the chat — the way a
 * shared post appears in a DM. Only the id is stored; the card reads the
 * item itself, so a rename shows and a deleted one says so.
 */
export interface MessageAttachment {
  kind: 'recording' | 'assignment'
  id: string
}

/** One message between a teacher and a student. One thread per pair. */
export interface Message {
  id: string
  teacherId: string
  studentId: string
  from: 'teacher' | 'student'
  /** May be empty when the message is only a shared item. */
  text: string
  createdAt: string
  attachment?: MessageAttachment
}

export interface TeacherNote {
  id: string
  teacherId: string
  studentId: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface Reminder {
  id: string
  userId: string
  type: 'daily_practice' | 'goal_progress' | 'piece_neglected' | 'streak_risk'
  message: string
  read: boolean
  createdAt: string
}

export interface LessonSlot {
  id: string
  teacherId: string
  studentId: string
  studentName: string
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
  startTime: string
  durationMinutes: number
  createdAt: string
  updatedAt: string
}

/** One attempt at handing work in. Append-only: a returned assignment is
 *  resubmitted, and the trail of attempts is the record of the work. */
export interface Submission {
  at: string
  note?: string
  /** Ids of recordings already captured in practice sessions. */
  recordingIds?: string[]
  /** Minutes practised on the assignment at the moment of submitting. */
  minutesAtSubmission?: number
}

/** A teacher's response to a submission. Also append-only. */
export interface TeacherFeedback {
  at: string
  verdict: 'approved' | 'returned'
  note?: string
}

export interface Assignment {
  id: string
  teacherId: string
  studentId: string
  title: string
  description?: string
  dueDate?: string
  category?: PracticeCategory
  targetMinutes?: number
  /**
   * Both vocabularies, deliberately. 'active' | 'completed' | 'dismissed'
   * are what existing documents carry; the rest are the review loop. Kept
   * as a union rather than widened to string so a typo is still a compile
   * error. Nothing compares this field directly — reads go through
   * normaliseStatus in lib/utils/assignments, which understands both.
   */
  status:
    | 'active' | 'completed' | 'dismissed'
    | 'assigned' | 'submitted' | 'returned' | 'approved' | 'cancelled'
  completedAt?: string
  createdAt: string
  updatedAt: string
  /** Set when the work is tied to a specific piece, enabling auto-progress. */
  pieceId?: string
  /** Teacher wants to hear it, not just be told it is done. */
  requiresRecording?: boolean
  /**
   * Minutes required *each day*, from the day it was set until its due
   * date — "thirty minutes a day until our next lesson". Distinct from
   * targetMinutes, which is a single total to reach by the deadline.
   */
  dailyTargetMinutes?: number
  /**
   * Which kind of assignment this is. Absent on everything created before
   * the distinction existed, so it is inferred rather than required — see
   * assignmentType in lib/utils/assignments.
   */
  type?: 'task' | 'daily'
  submissions?: Submission[]
  feedback?: TeacherFeedback[]
}

/**
 * One invitation to one student.
 *
 * The document id is the token — 16 random bytes, base64url — and the
 * token is the whole secret, so the document is readable by anyone
 * holding it and listable by nobody. That is what lets the link work
 * before the person it was sent to has an account.
 *
 * It therefore carries nothing private. The teacher does not name the
 * invite; the student's name arrives on the request, once they claim it.
 *
 * `expiresAt` is a Firestore Timestamp while every other date in this
 * file is an ISO string. Security rules cannot parse an ISO string, and
 * the expiry has to be enforced in the rules rather than only in the
 * client — so this one field is stored in the type the rules can compare
 * against `request.time`.
 */
export interface StudioInvite {
  /** The document id, and the secret. */
  token: string
  teacherId: string
  teacherName: string
  studioName: string
  createdAt: string
  updatedAt?: string
  /** Firestore Timestamp. See the note above. */
  expiresAt: Date
  status: 'open' | 'claimed' | 'revoked'
}

/**
 * The short code a teacher can read out in a lesson, pointing at an
 * invite. A pointer document rather than a field, so resolving a code is
 * one read by id and never a query over invitations.
 */
export interface InviteCode {
  /** The document id: six characters, no I/O/0/1. */
  code: string
  token: string
  teacherId: string
  expiresAt: Date
}

/**
 * A student asking to join a studio, waiting on the teacher's answer.
 *
 * The document id is always `${studentId}_${teacherId}`. That is load
 * bearing twice over: a rule can fetch the request by id when the teacher
 * accepts, with no query, and a student can have only one open request
 * per teacher, so the collection cannot be flooded.
 */
export interface StudioRequest {
  id: string
  studentId: string
  teacherId: string
  studentName: string
  instrument?: InstrumentType
  inviteToken: string
  createdAt: string
  status: 'pending' | 'accepted' | 'declined'
  decidedAt?: string
}

export interface AnalyticsSummary {
  totalMinutesThisWeek: number
  totalMinutesThisMonth: number
  currentStreak: number
  longestStreak: number
  weeklyGoalPercentage: number
  consistencyScore: number
  mostPracticedCategory: PracticeCategory | null
  avgDailyMinutes: number
}

export interface DailyPracticeData {
  date: string
  minutes: number
  sessions: number
}

export interface CategoryData {
  category: PracticeCategory
  minutes: number
  percentage: number
}

/**
 * What a student's classmates may see: how long they practised each day,
 * and nothing else. No pieces, no categories, no notes, no sessions.
 */
export interface StudioStats {
  uid: string
  displayName: string
  instrument?: InstrumentType
  /**
   * Which studio this belongs to. Stored on the document so classmates can
   * be found with a single query — without it, a leaderboard would have to
   * read everyone's profile to work out who shares a teacher.
   */
  teacherId?: string
  currentStreak: number
  /** 'yyyy-MM-dd' -> minutes practised that day. */
  dailyMinutes: Record<string, number>
  updatedAt: string
}

/**
 * What a student's teacher may see. Everything the teacher's charts need,
 * derived down to per-day totals — so a teacher never reads a practice
 * session document, and therefore never sees the thoughts pad.
 */
export interface PracticeSummary {
  uid: string
  dailyMinutes: Record<string, number>
  /** 'yyyy-MM-dd' -> category -> minutes. */
  dailyCategories: Record<string, Record<string, number>>
  totalSessions: number
  updatedAt: string
}
