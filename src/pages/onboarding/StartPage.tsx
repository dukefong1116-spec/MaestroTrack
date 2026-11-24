import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Femata from '@/components/femata/Femata'
import { Stage, BigButton, STAGE } from '@/components/onboarding/stage'
import { useAuth } from '@/hooks/useAuth'
import Avatar from '@/components/profile/Avatar'
import { lastLogin, forgetLogin } from '@/lib/lastLogin'
import type { InstrumentType } from '@/types'

/** The front door for someone signed out: Femata, the name, and two ways in. */
export default function StartPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  // Signed out, but someone has signed in on this device before: "Is this you?"
  const [last, setLast] = useState(lastLogin)

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
      {last && !user && (
        <div className="mb-4 rounded-[20px] p-4 text-left" style={{ background: STAGE.ink2, border: `1px solid ${STAGE.ink3}` }}>
          <p className="text-[12px] font-bold uppercase tracking-[.12em]" style={{ color: STAGE.muted }}>Is this you?</p>
          <div className="mt-2 flex items-center gap-3">
            <Avatar src={last.avatar} name={last.name || last.email} instrument={last.instrument as InstrumentType | undefined} size={46} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-bold" style={{ color: STAGE.cream }}>{last.name || last.email}</p>
              {last.name && <p className="truncate text-[13px]" style={{ color: STAGE.muted }}>{last.email}</p>}
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => navigate('/login')} className="flex-1 rounded-full py-2.5 text-[14px] font-bold" style={{ background: STAGE.sky, color: STAGE.ink }}>
              Continue as {(last.name || last.email).split(' ')[0]}
            </button>
            <button type="button" onClick={() => { forgetLogin(); setLast(null) }} className="rounded-full px-4 py-2.5 text-[14px] font-bold" style={{ color: STAGE.muted }}>
              Not you
            </button>
          </div>
        </div>
      )}
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
