import { unlock, audioState, type AudioState } from './engine'

/**
 * Does audio actually work on *this* device?
 *
 * Every previous attempt to fix the sound was verified in a Chromium
 * browser, where `resume()` is honoured long after the click that earned
 * it. Safari refuses that, so the one browser the app is used in was the
 * one never tested — and "it works" was said twice about a bug that was
 * still there.
 *
 * This measures instead of assuming, on whatever browser is running it.
 *
 * It is deliberately silent: the test tone is routed into an analyser and
 * never reaches the speakers, so it proves the pipeline carries samples
 * without making a noise at someone practising.
 */

export interface AudioDiagnosis extends AudioState {
  /** Peak amplitude the analyser saw. Zero means nothing is flowing. */
  peak: number
  /** True when samples genuinely moved through the graph. */
  producesSound: boolean
  /** Short human summary. */
  verdict: string
}

export async function diagnoseAudio(): Promise<AudioDiagnosis> {
  const ctx = unlock()
  const state = audioState()

  if (!ctx) {
    return {
      ...state, peak: 0, producesSound: false,
      verdict: 'No audio context could be opened. Another tab may be holding them, or this browser is blocking audio.',
    }
  }

  if (ctx.state !== 'running') {
    return {
      ...state, peak: 0, producesSound: false,
      verdict: `The audio context is "${ctx.state}". The browser has not allowed sound to start — tap the button again.`,
    }
  }

  // Tone -> analyser only. Nothing connects to ctx.destination, so this is
  // measurable but inaudible.
  const osc = ctx.createOscillator()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  osc.frequency.value = 440
  osc.connect(analyser)
  osc.start()

  const buf = new Float32Array(analyser.fftSize)
  let peak = 0
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 25))
    analyser.getFloatTimeDomainData(buf)
    for (const v of buf) peak = Math.max(peak, Math.abs(v))
    if (peak > 0.05) break
  }

  try { osc.stop(); osc.disconnect(); analyser.disconnect() } catch { /* already torn down */ }

  const producesSound = peak > 0.01
  return {
    ...audioState(),
    peak: Number(peak.toFixed(4)),
    producesSound,
    verdict: producesSound
      ? 'Audio is working on this device.'
      : 'The context is running but no sound is being produced — this is the failure worth reporting.',
  }
}
