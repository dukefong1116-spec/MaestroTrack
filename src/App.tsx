import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { armAudioContext } from '@/lib/utils/sound'
import { useAuthInit } from '@/hooks/useAuth'
import { useStudentData } from '@/hooks/useStudentData'
import { useSummarySync } from '@/hooks/useSummarySync'
import { useTeacherData } from '@/hooks/useTeacherData'
import { useAuth } from '@/hooks/useAuth'
import ProtectedRoute from '@/features/auth/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import PendingUploads from '@/components/common/PendingUploads'

/**
 * Login is loaded eagerly — it is the first thing anyone sees, and making
 * the entry screen wait on a second request to show a password box would
 * trade one delay for another.
 */
import LoginPage from '@/pages/auth/LoginPage'

/**
 * Everything else arrives when it is actually visited.
 *
 * The whole app used to ship as one 1.77MB file, so signing in meant
 * downloading the charting library, the teacher dashboard, the metronome,
 * the tuner, the pitch detector, the recorder and every celebration
 * animation before the email field could be typed into. A student never
 * opens a teacher page; a teacher never opens the practice session. Each
 * screen now costs only the people who go there.
 */
const SignupPage = lazy(() => import('@/pages/auth/SignupPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))

const StudentDashboard = lazy(() => import('@/pages/student/StudentDashboard'))
const PracticeLogPage = lazy(() => import('@/pages/student/PracticeLogPage'))
const SessionPage = lazy(() => import('@/pages/student/SessionPage'))
const LibraryPage = lazy(() => import('@/pages/student/LibraryPage'))
const ProgressPage = lazy(() => import('@/pages/student/ProgressPage'))
const SettingsPage = lazy(() => import('@/pages/student/SettingsPage'))

const TeacherDashboard = lazy(() => import('@/pages/teacher/TeacherDashboard'))
const StudentsPage = lazy(() => import('@/pages/teacher/StudentsPage'))
const StudentDetailPage = lazy(() => import('@/pages/teacher/StudentDetailPage'))
const ResearchPage = lazy(() => import('@/pages/teacher/ResearchPage'))
const TeacherSettingsPage = lazy(() => import('@/pages/teacher/TeacherSettingsPage'))
const SchedulePage = lazy(() => import('@/pages/teacher/SchedulePage'))

function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--clay-bg)' }}>
      <div
        className="w-10 h-10 rounded-full animate-spin"
        style={{ border: '4px solid var(--clay-accent-soft)', borderTopColor: 'var(--clay-accent)' }}
      />
    </div>
  )
}

function DataProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  useStudentData(profile?.role === 'student' ? profile?.uid : undefined)
  // Keeps the rolled-up copies current, and backfills one for anyone who
  // has practised but never had a summary written.
  useSummarySync()
  useTeacherData(profile?.role === 'teacher' ? profile?.uid : undefined)
  return (
    <>
      {children}
      {/* Global, so a take left over from a closed tab is picked up on any
          page — including the session page itself. */}
      <PendingUploads />
    </>
  )
}

function AppRoutes() {
  useAuthInit()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/*
        Full-screen practice session. Deliberately a sibling of /student
        rather than a child, so it renders outside AppLayout and takes over
        the whole screen with no sidebar.
      */}
      <Route path="/student/session" element={
        <ProtectedRoute role="student">
          <DataProvider>
            <SessionPage />
          </DataProvider>
        </ProtectedRoute>
      } />

      <Route path="/student" element={
        <ProtectedRoute role="student">
          <DataProvider>
            <AppLayout />
          </DataProvider>
        </ProtectedRoute>
      }>
        <Route index element={<StudentDashboard />} />
        <Route path="practice" element={<PracticeLogPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="settings" element={<SettingsPage />} />

        {/* Retired routes — redirected so existing links and bookmarks
            keep working after the Library/Progress consolidation. */}
        <Route path="pieces" element={<Navigate to="/student/library" replace />} />
        <Route path="performances" element={<Navigate to="/student/library?tab=performances" replace />} />
        <Route path="goals" element={<Navigate to="/student/progress" replace />} />
        <Route path="insights" element={<Navigate to="/student/progress" replace />} />
        <Route path="analytics" element={<Navigate to="/student/progress" replace />} />
        <Route path="reminders" element={<Navigate to="/student" replace />} />
      </Route>

      <Route path="/teacher" element={
        <ProtectedRoute role="teacher">
          <DataProvider>
            <AppLayout />
          </DataProvider>
        </ProtectedRoute>
      }>
        <Route index element={<TeacherDashboard />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/:studentId" element={<StudentDetailPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="research" element={<ResearchPage />} />
        <Route path="settings" element={<TeacherSettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  // Celebration sounds fire from effects, not clicks, so the audio context
  // has to be opened by the first gesture the app sees — whatever it is.
  useEffect(() => { armAudioContext() }, [])

  return (
    <BrowserRouter>
      {/* Shown only while a screen's code is in flight, which on a warm
          cache is never. Matches the auth loader so a transition does not
          flash a different-looking spinner. */}
      <Suspense fallback={<RouteLoading />}>
        <AppRoutes />
      </Suspense>
    </BrowserRouter>
  )
}
