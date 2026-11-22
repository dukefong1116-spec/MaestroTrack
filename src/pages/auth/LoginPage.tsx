import { useEffect, useState } from 'react'
import { takePendingInvite } from '@/lib/utils/pendingInvite'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { signIn, getUserProfile } from '@/lib/firebase/auth'
import Input from '@/components/ui/Input'
import Femata from '@/components/femata/Femata'
import Button from '@/components/ui/Button'
import Avatar from '@/components/profile/Avatar'
import { lastLogin, forgetLogin } from '@/lib/lastLogin'
import type { InstrumentType } from '@/types'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const { register, handleSubmit, setValue, setFocus, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })
  // Whoever last signed in here: their email filled in, only the password to type.
  const [last, setLast] = useState(lastLogin)
  useEffect(() => {
    if (!last) return
    setValue('email', last.email)
    const t = setTimeout(() => setFocus('password'), 350)
    return () => clearTimeout(t)
  }, [last, setValue, setFocus])
  function notMe() {
    forgetLogin()
    setLast(null)
    setValue('email', '')
    setTimeout(() => setFocus('email'), 0)
  }

  async function onSubmit(data: FormData) {
    setError('')
    try {
      const user = await signIn(data.email, data.password)
      let role: string | null = null
      try {
        const profile = await getUserProfile(user.uid)
        role = profile?.role ?? null
      } catch { /* offline — fall through */ }
      if (!role) {
        try {
          const cached = localStorage.getItem(`maestro_profile_${user.uid}`)
          if (cached) role = JSON.parse(cached)?.role ?? null
        } catch { /* ignore */ }
      }
      if (!role) role = localStorage.getItem(`maestro_role_${user.uid}`)
      role = role ?? 'student'
      localStorage.setItem(`maestro_role_${user.uid}`, role)
      // Signed in from a teacher's invitation: finish that, not the
      // usual landing page. Teachers are sent on as normal — a teaching
      // account has no business claiming an invitation.
      const invited = role === 'teacher' ? null : takePendingInvite()
      navigate(invited ? `/join/${invited}` : role === 'teacher' ? '/teacher' : '/student')
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string }
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password.')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait and try again.')
      } else {
        setError(err.message ?? 'Sign-in failed. Please try again.')
      }
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4" style={{ background: 'var(--clay-page)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 60% 0%, rgba(232,80,58,.06) 0%, transparent 60%)' }} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="mb-3 flex justify-center"><Femata mood="happy" tone="pop" size={132} /></div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--clay-ink)' }}>Femata</h1>
          <p className="mt-2" style={{ color: 'var(--clay-dim)' }}>The practice intelligence platform for musicians</p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'var(--clay-surface)', border: 'none' }}>
          <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--clay-ink)' }}>Welcome back</h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--clay-accent-soft)', border: 'none', color: 'var(--clay-danger)' }}>
              {error}
            </div>
          )}

          {last && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl p-3" style={{ background: 'var(--clay-bg)' }}>
              <Avatar src={last.avatar} name={last.name || last.email} instrument={last.instrument as InstrumentType | undefined} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-semibold uppercase tracking-[.08em]" style={{ color: 'var(--clay-dim)' }}>Last signed in as</p>
                <p className="truncate text-[15px] font-bold" style={{ color: 'var(--clay-ink)' }}>{last.name || last.email}</p>
                {last.name && <p className="truncate text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>{last.email}</p>}
              </div>
              <button type="button" onClick={notMe} className="shrink-0 text-[13px] font-semibold" style={{ color: 'var(--clay-accent)' }}>Not you?</button>
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className={last ? 'hidden' : undefined}>
              <Input label="Email" type="email" placeholder="you@example.com" autoComplete="username" error={errors.email?.message} {...register('email')} />
            </div>
            <Input label="Password" type="password" placeholder="••••••••" error={errors.password?.message} {...register('password')} />
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs font-medium transition-colors" style={{ color: 'var(--clay-accent)' }}>
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Sign In
            </Button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'var(--clay-dim)' }}>
            New here?{' '}
            <Link to="/start/setup" className="font-medium transition-colors" style={{ color: 'var(--clay-accent)' }}>
              Create an account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
