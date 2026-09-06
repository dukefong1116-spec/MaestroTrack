import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { resetPassword } from '@/lib/firebase/auth'
import Input from '@/components/ui/Input'
import { KeyRound, MailCheck } from 'lucide-react'
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#EDEAE4' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center" style={{ color: '#E8503A' }}><KeyRound size={48} strokeWidth={1.5} /></div>
          <h1 className="text-2xl font-bold" style={{ color: '#22201C' }}>Reset Password</h1>
          <p className="mt-2" style={{ color: '#6B6860' }}>We'll send a reset link to your email</p>
        </div>
        <div className="rounded-2xl p-8" style={{ background: '#F8F6F2', border: '1px solid #DEDAD2', boxShadow: '0 8px 32px -8px rgba(34,32,28,.12)' }}>
          {sent ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center" style={{ color: '#2C7A4B' }}><MailCheck size={44} strokeWidth={1.5} /></div>
              <p className="font-semibold" style={{ color: '#22201C' }}>Check your inbox!</p>
              <p className="text-sm" style={{ color: '#6B6860' }}>Password reset email sent.</p>
              <Link to="/login" className="text-sm font-medium" style={{ color: '#E8503A' }}>Back to Sign In</Link>
            </div>
          ) : (
            <>
              {error && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#FEF0EE', border: '1px solid #FDDDD9', color: '#C0392B' }}>{error}</div>}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input label="Email" type="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
                <Button type="submit" className="w-full" loading={isSubmitting}>Send Reset Link</Button>
              </form>
              <p className="text-center text-sm mt-6">
                <Link to="/login" className="font-medium" style={{ color: '#E8503A' }}>Back to Sign In</Link>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
