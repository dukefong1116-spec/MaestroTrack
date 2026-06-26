import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { resetPassword } from '@/lib/firebase/auth'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

const schema = z.object({ email: z.string().email() })
type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setError('')
    try {
      await resetPassword(data.email)
      setSent(true)
    } catch {
      setError('Failed to send reset email. Check the address and try again.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔑</div>
          <h1 className="text-2xl font-bold text-white">Reset Password</h1>
          <p className="text-slate-400 mt-2">We'll send a reset link to your email</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800/60 rounded-2xl p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📧</div>
              <p className="text-white font-semibold">Check your inbox!</p>
              <p className="text-slate-400 text-sm">Password reset email sent.</p>
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">Back to Sign In</Link>
            </div>
          ) : (
            <>
              {error && <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input label="Email" type="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
                <Button type="submit" className="w-full" loading={isSubmitting}>Send Reset Link</Button>
              </form>
              <p className="text-center text-sm text-slate-400 mt-6">
                <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">Back to Sign In</Link>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
