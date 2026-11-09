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
import TourLayer from '@/components/onboarding/TourLayer'

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
const JoinPage = lazy(() => import('@/pages/auth/JoinPage'))

const StudentDashboard = lazy(() => import('@/pages/student/StudentDashboard'))
const PracticeLogPage = lazy(() => import('@/pages/student/PracticeLogPage'))
const SessionPage = lazy(() => import('@/pages/student/SessionPage'))
const LibraryPage = lazy(() => import('@/pages/student/LibraryPage'))
const ProgressPage = lazy(() => import('@/pages/student/ProgressPage'))
const StudioPage = lazy(() => import('@/pages/student/StudioPage'))
const SettingsPage = lazy(() => import('@/pages/student/SettingsPage'))
const JoinStudioPage = lazy(() => import('@/pages/student/JoinStudioPage'))
import BackendBadge from '@/components/common/BackendBadge'

const ProfilePage = lazy(() => import('@/pages/student/ProfilePage'))
const ProfilePhotoPage = lazy(() => import('@/pages/student/ProfilePhotoPage'))

/* Shared by both roles — each reads the signed-in role to know where its
   back arrow goes and which controls apply. */
const NotificationsPage = lazy(() => import('@/pages/settings/NotificationsPage'))
const AppearancePage = lazy(() => import('@/pages/settings/AppearancePage'))
const PrivacyPage = lazy(() => import('@/pages/settings/PrivacyPage'))
const SharedLinksPage = lazy(() => import('@/pages/settings/SharedLinksPage'))
const AboutPage = lazy(() => import('@/pages/settings/AboutPage'))

const TeacherDashboard = lazy(() => import('@/pages/teacher/TeacherDashboard'))
const StudentsPage = lazy(() => import('@/pages/teacher/StudentsPage'))
const StudentDetailPage = lazy(() => import('@/pages/teacher/StudentDetailPage'))
const ResearchPage = lazy(() => import('@/pages/teacher/ResearchPage'))
const TeacherSettingsPage = lazy(() => import('@/pages/teacher/TeacherSettingsPage'))
const TeacherProfilePage = lazy(() => import('@/pages/teacher/TeacherProfilePage'))
const SchedulePage = lazy(() => import('@/pages/teacher/SchedulePage'))

function RouteLoading() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: 'var(--clay-bg)' }}>
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
      {/* Global for the same reason: the first session, which the tour
          walks through, runs outside the main layout. */}
      <TourLayer />
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
      {/* A teacher's invitation. Public on purpose: the person it was sent
          to very often has no account yet, and the page is what tells them
          whose studio they are being asked into. */}
      <Route path="/join/:token" element={<JoinPage />} />

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
        <Route path="studio" element={<StudioPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* Nested under settings on purpose: the Settings tab and the
            sidebar item match by prefix, so they stay lit while you are
            in here. */}
        <Route path="settings/join" element={<JoinStudioPage />} />
        <Route path="settings/profile" element={<ProfilePage />} />
        <Route path="settings/profile/photo" element={<ProfilePhotoPage />} />
        <Route path="settings/notifications" element={<NotificationsPage />} />
        <Route path="settings/appearance" element={<AppearancePage />} />
        <Route path="settings/privacy" element={<PrivacyPage />} />
        <Route path="settings/privacy/links" element={<SharedLinksPage />} />
        <Route path="settings/about" element={<AboutPage />} />

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
        <Route path="settings/profile" element={<TeacherProfilePage />} />
        {/* The same photo screen the student uses; it knows which Settings
            to send you back to from the signed-in role. */}
        <Route path="settings/profile/photo" element={<ProfilePhotoPage />} />
        <Route path="settings/notifications" element={<NotificationsPage />} />
        <Route path="settings/appearance" element={<AppearancePage />} />
        <Route path="settings/privacy" element={<PrivacyPage />} />
        <Route path="settings/privacy/links" element={<SharedLinksPage />} />
        <Route path="settings/about" element={<AboutPage />} />
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
      {/* Outside Suspense and outside the routes, so it is on the login
          screen too — which is exactly where the wrong backend bites. */}
      <BackendBadge />
    </BrowserRouter>
  )
}
