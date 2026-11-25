import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Stage, BigButton, STAGE } from '@/components/onboarding/stage'

const KEY = 'femata_age_13_confirmed'

/** Self-attested minimum-age screen, shown before any account setup asks for personal details. */
export default function AgeEligibilityGate({ children }: { children: ReactNode }) {
  const [eligible, setEligible] = useState(() => {
    try { return sessionStorage.getItem(KEY) === 'yes' } catch { return false }
  })
  const [underage, setUnderage] = useState(false)

  if (eligible) return children

  return (
    <Stage staff>
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-[30px] font-black leading-tight">Before you join</h1>
        {underage ? (
          <>
            <p className="mt-4 text-[16px] font-semibold leading-relaxed" style={{ color: STAGE.muted }}>
              Children under 13 cannot create an account yet. We do not collect your name or email here. Please ask a parent or guardian to contact{' '}
              <a className="underline" style={{ color: STAGE.sky }} href="mailto:help@femataus.com">help@femataus.com</a>.
            </p>
            <button type="button" className="mt-6 text-left text-[14px] font-bold" style={{ color: STAGE.sky }} onClick={() => setUnderage(false)}>Back</button>
          </>
        ) : (
          <>
            <p className="mt-4 text-[16px] font-semibold leading-relaxed" style={{ color: STAGE.muted }}>
              New Femata accounts are currently for people aged 13 and older. Children under 13 cannot create an account.
            </p>
            <div className="mt-6"><BigButton onClick={() => {
              try { sessionStorage.setItem(KEY, 'yes') } catch { /* the age screen still works for this visit */ }
              setEligible(true)
            }}>I AM 13 OR OLDER</BigButton></div>
            <button type="button" className="mt-4 text-center text-[14px] font-bold" style={{ color: STAGE.muted }} onClick={() => setUnderage(true)}>I am under 13</button>
            <p className="mt-6 text-center text-[13px] font-semibold" style={{ color: STAGE.muted }}>Already have an account? <Link to="/login" className="font-extrabold" style={{ color: STAGE.sky }}>Log in</Link></p>
          </>
        )}
      </div>
    </Stage>
  )
}
