import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthInit } from '@/hooks/useAuth'
import { useStudentData } from '@/hooks/useStudentData'
import { useTeacherData } from '@/hooks/useTeacherData'
import { useAuth } from '@/hooks/useAuth'
import ProtectedRoute from '@/features/auth/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'

import LoginPage from '@/pages/auth/LoginPage'
import SignupPage from '@/pages/auth/SignupPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'

import StudentDashboard from '@/pages/student/StudentDashboard'
import PracticeLogPage from '@/pages/student/PracticeLogPage'
import SessionPage from '@/pages/student/SessionPage'
import LibraryPage from '@/pages/student/LibraryPage'
import ProgressPage from '@/pages/student/ProgressPage'
import SettingsPage from '@/pages/student/SettingsPage'

import TeacherDashboard from '@/pages/teacher/TeacherDashboard'
import StudentsPage from '@/pages/teacher/StudentsPage'
import StudentDetailPage from '@/pages/teacher/StudentDetailPage'
import ResearchPage from '@/pages/teacher/ResearchPage'
import TeacherSettingsPage from '@/pages/teacher/TeacherSettingsPage'
import SchedulePage from '@/pages/teacher/SchedulePage'

function DataProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  useStudentData(profile?.role === 'student' ? profile?.uid : undefined)
  useTeacherData(profile?.role === 'teacher' ? profile?.uid : undefined)
  return <>{children}</>
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
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
