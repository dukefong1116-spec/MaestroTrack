import { useEffect, useState } from 'react'
import { Sun, Moon, Zap, Vibrate } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePrefs } from '@/hooks/usePrefs'
import { SCALES, type ThemeChoice } from '@/lib/utils/prefs'
import { Panel, Block, Legend, ToggleRow, SettingsScreen } from '@/components/ui/Panel'
import { haptic, setHapticsEnabled } from '@/lib/haptics'

const THEMES: { id: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
]

export default function AppearancePage() {
  const { profile } = useAuth()
  const { prefs, set } = usePrefs()
  // A change the database would not take: said plainly, not silently undone.
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const on = () => setFailed(true)
    window.addEventListener('femata:prefs-failed', on)
    return () => window.removeEventListener('femata:prefs-failed', on)
  }, [])
  const back = profile?.role === 'teacher' ? '/teacher/settings' : '/student/settings'

  return (
    <SettingsScreen title="Appearance" back={back}>
      {failed && (
        <p className="mb-3 rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--clay-accent-soft)', color: 'var(--clay-danger)' }}>
          That change didn't save. Check your connection and try again.
        </p>
      )}
      <Panel>
        <Block first>
          <Legend title="Theme" />
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map(({ id, label, icon: Icon }) => {
              const on = prefs.theme === id
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => void set({ theme: id })}
                  className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-[var(--clay-r-sm)] transition-transform active:scale-95"
                  style={{
                    background: on ? 'var(--clay-accent)' : 'var(--clay-bg)',
                    color: on ? 'var(--clay-on-accent)' : 'var(--clay-dim)',
                    boxShadow: on ? 'var(--clay-accent-shadow)' : 'none',
                  }}
                >
                  <Icon size={20} />
                  <span className="text-xs font-semibold">{label}</span>
                </button>
              )
            })}
          </div>
        </Block>

        <Block>
          <Legend title="Display size" hint="Scales the page. The navigation stays the size a thumb expects." />
          <div className="grid grid-cols-4 gap-2">
            {SCALES.map((s) => {
              const on = prefs.displayScale === s
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => void set({ displayScale: s })}
                  className="min-h-[52px] rounded-[var(--clay-r-sm)] font-semibold transition-transform active:scale-95"
                  style={{
                    background: on ? 'var(--clay-accent)' : 'var(--clay-bg)',
                    color: on ? 'var(--clay-on-accent)' : 'var(--clay-dim)',
                    boxShadow: on ? 'var(--clay-accent-shadow)' : 'none',
                    fontSize: 11 + (s - 90) * 0.12,
                  }}
                >
                  {s === 100 ? 'Default' : `${s}%`}
                </button>
              )
            })}
          </div>
        </Block>
        <ToggleRow
          icon={<Zap size={19} />}
          label="Reduce motion"
          hint="Turns off the celebrations and the sliding. Already on if your device asks for it."
          checked={prefs.reduceMotion}
          onChange={(next) => void set({ reduceMotion: next })}
        />
        <ToggleRow
          icon={<Vibrate size={19} />}
          label="Haptics"
          hint="Little taps and rumbles when your streak lights, a session finishes, or you pat Femata."
          checked={prefs.haptics}
          onChange={(next) => {
            void set({ haptics: next })
            // Felt as it switches on, so you know what you turned on.
            if (next) { setHapticsEnabled(true); haptic('success') }
          }}
        />
      </Panel>
    </SettingsScreen>
  )
}
