import { Sun, Moon, Monitor, Zap } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePrefs } from '@/hooks/usePrefs'
import { getInstrumentTheme } from '@/lib/utils/instruments'
import { ACCENTS, SCALES, type AccentName, type ThemeChoice } from '@/lib/utils/prefs'
import { Panel, Block, Legend, ToggleRow, SettingsScreen } from '@/components/settings/Panel'
import { cn } from '@/lib/utils/cn'
import type { InstrumentType } from '@/types'

const THEMES: { id: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
]

export default function AppearancePage() {
  const { profile } = useAuth()
  const { prefs, set } = usePrefs()
  const back = profile?.role === 'teacher' ? '/teacher/settings' : '/student/settings'
  const instrument = profile?.instrument as InstrumentType | undefined
  // Raw, not getTheme: this swatch is a preview of what 'match my
  // instrument' would look like, so running it through the override made
  // it show the accent already chosen — the option misrepresenting itself.
  const instrumentTheme = getInstrumentTheme(instrument)

  return (
    <SettingsScreen title="Appearance" back={back}>
      <Panel>
        <Block first>
          <Legend title="Theme" hint="System follows whatever your phone or computer is set to." />
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
          <Legend
            title="Accent"
            hint="Match my instrument keeps the colour your instrument gives the app. Anything else replaces it everywhere."
          />
          <div className="flex flex-wrap gap-2.5">
            <Swatch
              name="instrument"
              label={`Match my ${instrumentTheme.label.toLowerCase()}`}
              colour={instrumentTheme.primary}
              selected={prefs.accent === 'instrument'}
              onPick={() => void set({ accent: 'instrument' })}
            />
            {(Object.keys(ACCENTS) as Exclude<AccentName, 'instrument'>[]).map((name) => (
              <Swatch
                key={name}
                name={name}
                label={ACCENTS[name].label}
                colour={ACCENTS[name].accent}
                selected={prefs.accent === name}
                onPick={() => void set({ accent: name })}
              />
            ))}
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
      </Panel>

      <Panel>
        <ToggleRow
          first
          icon={<Zap size={19} />}
          label="Reduce motion"
          hint="Turns off the celebrations and the sliding. Already on if your device asks for it."
          checked={prefs.reduceMotion}
          onChange={(next) => void set({ reduceMotion: next })}
        />
      </Panel>
    </SettingsScreen>
  )
}

function Swatch({
  name, label, colour, selected, onPick,
}: {
  name: string
  label: string
  colour: string
  selected: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      data-accent={name}
      className={cn(
        'h-11 w-11 rounded-full transition-transform active:scale-90',
        selected && 'ring-2 ring-offset-2'
      )}
      style={{
        background: colour,
        // Tailwind's ring colours are its own palette; these are the app's.
        ['--tw-ring-color' as string]: 'var(--clay-ink)',
        ['--tw-ring-offset-color' as string]: 'var(--clay-surface)',
      }}
    />
  )
}
