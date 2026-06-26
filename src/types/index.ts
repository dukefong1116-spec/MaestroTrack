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
