import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types'

interface ProtectedRouteProps {
  children: ReactNode
  role?: UserRole
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const cachedRole = localStorage.getItem(`maestro_role_${user.uid}`)
  const effectiveRole = profile?.role ?? cachedRole

  if (role && effectiveRole && effectiveRole !== role) {
    return <Navigate to={effectiveRole === 'teacher' ? '/teacher' : '/student'} replace />
  }

  return <>{children}</>
}
