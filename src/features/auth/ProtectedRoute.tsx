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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--clay-bg)' }}>
        <div className="space-y-3 text-center">
          <div
            className="w-12 h-12 rounded-full animate-spin mx-auto"
            style={{ border: '4px solid var(--clay-accent-soft)', borderTopColor: 'var(--clay-accent)' }}
          />
          <p className="text-sm font-semibold" style={{ color: 'var(--clay-dim)', fontFamily: 'var(--clay-font)' }}>
            Loading…
          </p>
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
