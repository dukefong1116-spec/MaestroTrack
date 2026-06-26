import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { signIn } from '@/lib/firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormData = z.infer<typeof schema>

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setError('')
    try {
      console.log('[Login] Signing in:', data.email)
      const user = await signIn(data.email, data.password)
      console.log('[Login] Auth success, uid:', user.uid)

      // Determine role — try Firestore with timeout, fall back to localStorage
      let role = localStorage.getItem(`maestro_role_${user.uid}`) ?? 'student'
      try {
        const { getUserProfile } = await import('@/lib/firebase/auth')
        console.log('[Login] Fetching Firestore profile...')
        const profile = await withTimeout(getUserProfile(user.uid), 5000)
        if (profile?.role) {
          role = profile.role
          console.log('[Login] Got role from Firestore:', role)
          localStorage.setItem(`maestro_role_${user.uid}`, role)
        } else {
          console.log('[Login] No Firestore profile — using cached role:', role)

          // No Firestore doc yet — write the cached profile now
          const cached = localStorage.getItem(`maestro_profile_${user.uid}`)
          if (cached) {
            try {
              const parsed = JSON.parse(cached)
              const { uid: _uid, ...profileData } = parsed
              void _uid
              console.log('[Login] Writing cached profile to Firestore...')
              await setDoc(doc(db, 'users', user.uid), profileData, { merge: true })
              console.log('[Login] Profile written to Firestore ✓')
            } catch (syncErr) {
              console.warn('[Login] Profile sync failed:', syncErr)
            }
          }
        }
      } catch (profileErr) {
        console.warn('[Login] Profile fetch error (using cached role):', profileErr)
      }

      console.log('[Login] Navigating to:', role === 'teacher' ? '/teacher' : '/student')
      navigate(role === 'teacher' ? '/teacher' : '/student')
    } catch (e: unknown) {
      console.error('[Login] Sign-in error:', e)
      const err = e as { code?: string }
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password.')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a moment and try again.')
      } else {
        setError(`Sign-in failed: ${err.code ?? 'unknown error'}`)
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 via-slate-950 to-purple-950/20 pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎹</div>
          <h1 className="text-3xl font-bold text-white">MaestroTrack</h1>
          <p className="text-slate-400 mt-2">The practice intelligence platform for musicians</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/60 rounded-2xl p-8 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-white mb-6">Welcome back</h2>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Sign In
            </Button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            New here?{' '}
            <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Create an account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
