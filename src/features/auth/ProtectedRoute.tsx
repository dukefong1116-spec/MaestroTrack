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

  if (loading) return <AppSkeleton />

  if (!user) return <Navigate to="/login" replace />

  const cachedRole = localStorage.getItem(`maestro_role_${user.uid}`)
  const effectiveRole = profile?.role ?? cachedRole

  if (role && effectiveRole && effectiveRole !== role) {
    return <Navigate to={effectiveRole === 'teacher' ? '/teacher' : '/student'} replace />
  }

  return <>{children}</>
}

/**
 * The shape of Today in grey, while the very first sign-in check runs.
 * Shown only when nothing is saved on the device yet — every later open
 * starts from the saved copy (see useAuth) — and it reads as the app
 * arriving rather than as a wait.
 */
function AppSkeleton() {
  const bar = (w: string, h: number, extra: React.CSSProperties = {}) => (
    <div className="animate-pulse" style={{ width: w, height: h, borderRadius: 10, background: 'var(--clay-bg-deep)', ...extra }} />
  )
  return (
    <div className="min-h-[100dvh] px-4 pt-6" style={{ background: 'var(--clay-bg)' }} aria-busy="true" aria-label="Loading">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center gap-3 px-1">
          {bar('40px', 40, { borderRadius: 999 })}
          <div className="flex-1 space-y-1.5">{bar('30%', 10)}{bar('45%', 14)}</div>
        </div>
        <div className="space-y-5 p-5" style={{ background: 'var(--clay-surface)', borderRadius: 'var(--clay-r-md)' }}>
          <div className="flex justify-center">{bar('178px', 178, { borderRadius: 999 })}</div>
          <div className="flex flex-col items-center gap-1.5">{bar('40%', 16)}{bar('30%', 11)}</div>
          {bar('100%', 30)}
          {bar('100%', 40)}
          {bar('100%', 54, { borderRadius: 'var(--clay-r-sm)' })}
        </div>
      </div>
    </div>
  )
}
