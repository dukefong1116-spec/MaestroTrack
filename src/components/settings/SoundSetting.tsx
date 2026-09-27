import { useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import Card from '@/components/ui/Card'
import { isSoundMuted, setSoundMuted } from '@/lib/utils/sound'
import { diagnoseAudio, type AudioDiagnosis } from '@/lib/audio/diagnose'

/**
 * Sound preference.
 *
 * Until now the only mute control lived inside a celebration overlay that
 * dismisses itself after about three seconds, so turning the app quiet
 * meant finishing a session and catching a small icon before it vanished.
 *
 * Deliberately stored per device (localStorage) rather than on the
 * profile: wanting the app silent on a laptop in a shared room says
 * nothing about wanting it silent on your own phone.
 */
export default function SoundSetting() {
  const [muted, setMuted] = useState(isSoundMuted)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<AudioDiagnosis | null>(null)

  function toggle() {
    const next = !muted
    setMuted(next)
    setSoundMuted(next) // opens the audio context when un-muting — this is a gesture
  }

  async function check() {
    setChecking(true)
    setResult(null)
    try {
      setResult(await diagnoseAudio())
    } finally {
      setChecking(false)
    }
  }

  return (
    <Card className="p-6">
      <p className="text-sm font-semibold text-[var(--clay-faint)] mb-1">Sound</p>
      <p className="text-xs text-[var(--clay-dim)] mb-4">
        The chime when you finish a session, and the celebrations for streaks, badges
        and mastering a piece. The metronome and tuner are unaffected.
      </p>

      <button
        onClick={toggle}
        role="switch"
        aria-checked={!muted}
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors"
        style={{ background: 'var(--clay-bg)' }}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{
            background: muted ? 'var(--clay-bg-deep)' : 'var(--clay-accent)',
            color: muted ? 'var(--clay-dim)' : 'var(--clay-on-accent)',
          }}
        >
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold" style={{ color: 'var(--clay-ink)' }}>
            {muted ? 'Sounds are off' : 'Sounds are on'}
          </span>
          <span className="block text-xs" style={{ color: 'var(--clay-dim)' }}>
            {muted ? 'Tap to turn them back on' : 'Tap to silence the app on this device'}
          </span>
        </span>

        {/* track */}
        <span
          className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
          style={{ background: muted ? 'var(--clay-bg-deep)' : 'var(--clay-accent)' }}
        >
          <span
            className="absolute top-1 h-4 w-4 rounded-full transition-all"
            style={{ left: muted ? 4 : 24, background: '#fff' }}
          />
        </span>
      </button>

      {/* Measures rather than assumes, on whatever browser is running it —
          the previous two attempts at this bug were both verified in a
          browser the app is not used in. Silent: the test tone reaches an
          analyser, never the speakers. */}
      <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--clay-bg-deep)' }}>
        <button
          onClick={check}
          disabled={checking}
          className="text-[12.5px] font-semibold disabled:opacity-50"
          style={{ color: 'var(--clay-accent)' }}
        >
          {checking ? 'Checking…' : 'Check audio on this device'}
        </button>

        {result && (
          <div className="mt-2.5 px-3.5 py-3" style={{ background: 'var(--clay-bg)', borderRadius: 'var(--clay-r-sm)' }}>
            <p className="text-[12.5px] font-semibold" style={{ color: result.producesSound ? 'var(--clay-ink)' : 'var(--clay-danger)' }}>
              {result.verdict}
            </p>
            <p className="mt-1.5 text-[10.5px] leading-relaxed" style={{ color: 'var(--clay-faint)', fontFamily: 'ui-monospace, monospace' }}>
              context: {result.state} · rate: {result.sampleRate ?? '—'} · signal: {result.peak}
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
