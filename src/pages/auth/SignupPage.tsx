import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { signUp } from '@/lib/firebase/auth'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { INSTRUMENT_LIST, INSTRUMENT_THEMES } from '@/lib/utils/instruments'
import type { UserRole, InstrumentType } from '@/types'

const studentSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  instrument: z.enum(['piano','violin','viola','cello','flute','clarinet','saxophone','trumpet','trombone','percussion','voice','guitar'] as [InstrumentType, ...InstrumentType[]]),
  experienceLevel: z.enum(['beginner','intermediate','advanced','professional']),
  weeklyGoalMinutes: z.coerce.number().min(30).max(3000),
})

const teacherSchema = z.object({
  displayName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  studioName: z.string().min(2, 'Studio name required'),
})

type Step = 'role' | 'info'

export default function SignupPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<UserRole | null>(null)
  const [step, setStep] = useState<Step>('role')
  const [error, setError] = useState('')

  const studentForm = useForm({ resolver: zodResolver(studentSchema), defaultValues: { weeklyGoalMinutes: 300 } })
  const teacherForm = useForm({ resolver: zodResolver(teacherSchema) })

  async function onStudentSubmit(data: z.infer<typeof studentSchema>) {
    setError('')
    try {
      const user = await signUp(data.email, data.password, data.displayName, 'student', {
        instrument: data.instrument,
        experienceLevel: data.experienceLevel,
        weeklyGoalMinutes: data.weeklyGoalMinutes,
      })
      localStorage.setItem(`maestro_role_${user.uid}`, 'student')
      navigate('/student')
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string }
      if (err.code === 'auth/email-already-in-use') setError('Email already in use.')
      else setError(err.message ?? 'Sign up failed.')
    }
  }

  async function onTeacherSubmit(data: z.infer<typeof teacherSchema>) {
    setError('')
    try {
      const user = await signUp(data.email, data.password, data.displayName, 'teacher', { studioName: data.studioName })
      localStorage.setItem(`maestro_role_${user.uid}`, 'teacher')
      navigate('/teacher')
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string }
      if (err.code === 'auth/email-already-in-use') setError('Email already in use.')
      else setError(err.message ?? 'Sign up failed.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 via-slate-950 to-purple-950/20 pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎵</div>
          <h1 className="text-3xl font-bold text-white">Join MaestroTrack</h1>
          <p className="text-slate-400 mt-2">Your musical journey starts here</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/60 rounded-2xl p-8 backdrop-blur-sm">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
          )}

          <AnimatePresence mode="wait">
            {step === 'role' && (
              <motion.div key="role" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-xl font-semibold text-white mb-6">I am a…</h2>
                <div className="grid grid-cols-2 gap-4">
                  {(['student', 'teacher'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => { setRole(r); setStep('info') }}
                      className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-slate-700 hover:border-indigo-500 transition-all duration-200 hover:bg-indigo-500/10"
                    >
                      <span className="text-4xl">{r === 'student' ? '🎓' : '👩‍🏫'}</span>
                      <span className="font-semibold text-white capitalize">{r}</span>
                    </button>
                  ))}
                </div>
                <p className="text-center text-sm text-slate-400 mt-6">
                  Already have an account?{' '}
                  <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">Sign In</Link>
                </p>
              </motion.div>
            )}

            {step === 'info' && role === 'student' && (
              <motion.div key="student" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-6">
                  <button onClick={() => setStep('role')} className="text-slate-400 hover:text-white text-sm">← Back</button>
                  <h2 className="text-xl font-semibold text-white">Student Profile</h2>
                </div>
                <form onSubmit={studentForm.handleSubmit(onStudentSubmit)} className="space-y-4">
                  <Input label="Full Name" placeholder="Jane Smith" error={studentForm.formState.errors.displayName?.message} {...studentForm.register('displayName')} />
                  <Input label="Email" type="email" placeholder="jane@example.com" error={studentForm.formState.errors.email?.message} {...studentForm.register('email')} />
                  <Input label="Password" type="password" placeholder="••••••••" error={studentForm.formState.errors.password?.message} {...studentForm.register('password')} />
                  <Select
                    label="Instrument"
                    options={INSTRUMENT_LIST.map((i) => ({ value: i, label: `${INSTRUMENT_THEMES[i].emoji} ${INSTRUMENT_THEMES[i].label}` }))}
                    placeholder="Select your instrument"
                    error={studentForm.formState.errors.instrument?.message}
                    {...studentForm.register('instrument')}
                  />
                  <Select
                    label="Experience Level"
                    options={[
                      { value: 'beginner', label: 'Beginner' },
                      { value: 'intermediate', label: 'Intermediate' },
                      { value: 'advanced', label: 'Advanced' },
                      { value: 'professional', label: 'Professional' },
                    ]}
                    placeholder="Select level"
                    error={studentForm.formState.errors.experienceLevel?.message}
                    {...studentForm.register('experienceLevel')}
                  />
                  <Input label="Weekly Goal (minutes)" type="number" placeholder="300" error={studentForm.formState.errors.weeklyGoalMinutes?.message} {...studentForm.register('weeklyGoalMinutes')} />
                  <Button type="submit" className="w-full" size="lg" loading={studentForm.formState.isSubmitting}>Create Student Account</Button>
                </form>
              </motion.div>
            )}

            {step === 'info' && role === 'teacher' && (
              <motion.div key="teacher" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-6">
                  <button onClick={() => setStep('role')} className="text-slate-400 hover:text-white text-sm">← Back</button>
                  <h2 className="text-xl font-semibold text-white">Teacher Profile</h2>
                </div>
                <form onSubmit={teacherForm.handleSubmit(onTeacherSubmit)} className="space-y-4">
                  <Input label="Full Name" placeholder="Dr. Sarah Chen" error={teacherForm.formState.errors.displayName?.message} {...teacherForm.register('displayName')} />
                  <Input label="Studio Name" placeholder="Chen Music Studio" error={teacherForm.formState.errors.studioName?.message} {...teacherForm.register('studioName')} />
                  <Input label="Email" type="email" placeholder="sarah@example.com" error={teacherForm.formState.errors.email?.message} {...teacherForm.register('email')} />
                  <Input label="Password" type="password" placeholder="••••••••" error={teacherForm.formState.errors.password?.message} {...teacherForm.register('password')} />
                  <Button type="submit" className="w-full" size="lg" loading={teacherForm.formState.isSubmitting}>Create Teacher Account</Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
