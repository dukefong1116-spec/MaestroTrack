import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Femata from '@/components/femata/Femata'
import { Stage, BigButton, STAGE } from '@/components/onboarding/stage'
import { useAuth } from '@/hooks/useAuth'

/** The front door for someone signed out: Femata, the name, and two ways in. */
export default function StartPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  // Already signed in: straight to their own home.
  useEffect(() => {
    if (user && profile?.role) navigate(profile.role === 'teacher' ? '/teacher' : '/student', { replace: true })
  }, [user, profile?.role, navigate])

  return (
    <Stage staff>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.9 }}
          animate={{ y: [0, -8, 0], opacity: 1, scale: 1 }}
          transition={{ y: { duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }, opacity: { duration: 0.4 }, scale: { type: 'spring', stiffness: 260, damping: 18 } }}
        >
          <Femata mood="happy" tone="glow" onDark size={170} label="Femata" />
        </motion.div>
        <h1 className="mt-4 text-[44px] font-black leading-none tracking-[-.01em]">Femata</h1>
        <p className="mt-2 text-[17px] font-bold" style={{ color: STAGE.muted }}>Practice made fun.</p>
      </div>
      <div className="flex flex-col gap-2">
        <BigButton onClick={() => navigate('/start/setup')}>GET STARTED</BigButton>
        <BigButton kind="ghost" onClick={() => navigate('/login')}>I HAVE AN ACCOUNT</BigButton>
        <Link to="/start/studio" className="mt-1 text-center text-[13px] font-semibold" style={{ color: STAGE.sky }}>
          I teach — open a studio ›
        </Link>
      </div>
    </Stage>
  )
}
