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
import PiecesPage from '@/pages/student/PiecesPage'
import RecordingsPage from '@/pages/student/RecordingsPage'
import GoalsPage from '@/pages/student/GoalsPage'
import PerformancesPage from '@/pages/student/PerformancesPage'
import InsightsPage from '@/pages/student/InsightsPage'
import RemindersPage from '@/pages/student/RemindersPage'
import AnalyticsPage from '@/pages/student/AnalyticsPage'
import SettingsPage from '@/pages/student/SettingsPage'

import TeacherDashboard from '@/pages/teacher/TeacherDashboard'
import StudentsPage from '@/pages/teacher/StudentsPage'
import StudentDetailPage from '@/pages/teacher/StudentDetailPage'
import ResearchPage from '@/pages/teacher/ResearchPage'
import TeacherSettingsPage from '@/pages/teacher/TeacherSettingsPage'

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

      <Route path="/student" element={
        <ProtectedRoute role="student">
          <DataProvider>
            <AppLayout />
          </DataProvider>
        </ProtectedRoute>
      }>
        <Route index element={<StudentDashboard />} />
        <Route path="practice" element={<PracticeLogPage />} />
        <Route path="pieces" element={<PiecesPage />} />
        <Route path="recordings" element={<RecordingsPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="performances" element={<PerformancesPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="reminders" element={<RemindersPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
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
