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

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'professional'

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
  createdAt: string
  updatedAt: string
  reminderTime?: string
  reminderEnabled?: boolean
  theme?: 'light' | 'dark'
  avatar?: string
  /** Dates (yyyy-MM-dd) rescued by a streak freeze. */
  streakFreezesUsed?: string[]
  /** Badge ids whose unlock animation has already been shown. */
  badgesSeen?: string[]
  /** Piece ids already offered as "ready to call mastered?" — offered once each. */
  masteryPromptsSeen?: string[]
}

export interface PracticeSession {
  id: string
  userId: string
  date: string
  durationMinutes: number
  category: PracticeCategory
  pieceName?: string
  difficultyRating: number
  confidenceRating: number
  notes?: string
  createdAt: string
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
  pieceName: string
  date: string
  audioUrl: string
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

export interface StudioInvite {
  code: string
  teacherId: string
  teacherName: string
  studioName: string
  createdAt: string
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
