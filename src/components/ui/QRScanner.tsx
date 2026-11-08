import { useEffect, useRef, useState } from 'react'

/**
 * Point the camera at a QR code and read it.
 *
 * The decoder is imported on demand — it is bigger than this component
 * and only matters once somebody actually taps Scan.
 *
 * Deliberately narrow: it reports the text it found and nothing else.
 * Deciding whether that text is one of our invitations belongs to the
 * page, which is also the thing that knows what to do about it.
 */

type Phase = 'starting' | 'scanning' | 'denied' | 'insecure' | 'unavailable'

/**
 * getUserMedia exists only in a secure context. That is true of https and
 * of localhost, and *not* of http://192.168.x.x — which is exactly how
 * this app is opened on a phone during development, so the failure is
 * worth naming rather than reporting as a broken camera.
 */
function secureEnough(): boolean {
  if (typeof window === 'undefined') return false
  if (window.isSecureContext) return true
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

export default function QRScanner({
  onFound,
  onCancel,
}: {
  onFound: (text: string) => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [phase, setPhase] = useState<Phase>('starting')

  // The callback lives in a ref so the effect does not re-run — and so
  // restart the camera — every time the parent happens to re-render.
  const foundRef = useRef(onFound)
  useEffect(() => { foundRef.current = onFound }, [onFound])

  useEffect(() => {
    if (!secureEnough()) { setPhase('insecure'); return }
    if (!navigator.mediaDevices?.getUserMedia) { setPhase('unavailable'); return }

    const video = videoRef.current
    if (!video) return

    let cancelled = false
    let frame = 0
    let stream: MediaStream | null = null

    async function run() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // The back camera on a phone, whatever is there on a laptop.
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) return
        video!.srcObject = stream
        await video!.play()
        if (cancelled) return
        setPhase('scanning')

        const jsQR = (await import('jsqr')).default
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d', { willReadFrequently: true })
        if (!canvas || !ctx) { setPhase('unavailable'); return }

        const tick = () => {
          if (cancelled) return
          if (video!.readyState === video!.HAVE_ENOUGH_DATA && video!.videoWidth) {
            // Cap the working size: a 4K frame costs far more to scan than
            // it gains, and the loop has to keep up with the camera.
            const scale = Math.min(1, 640 / video!.videoWidth)
            canvas.width = Math.round(video!.videoWidth * scale)
            canvas.height = Math.round(video!.videoHeight * scale)
            ctx.drawImage(video!, 0, 0, canvas.width, canvas.height)
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const hit = jsQR(image.data, image.width, image.height, {
              inversionAttempts: 'dontInvert',
            })
            if (hit?.data) {
              cancelled = true          // stop the loop on this frame, not the next render
              foundRef.current(hit.data)
              return
            }
          }
          frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
      } catch (e) {
        if (cancelled) return
        const name = (e as { name?: string })?.name
        // A refusal is a decision, not a fault — it gets its own wording.
        setPhase(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
      }
    }

    void run()
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      // Release the camera, or the indicator light stays on after leaving.
      stream?.getTracks().forEach((t) => t.stop())
      if (video) video.srcObject = null
    }
  }, [])

  const message =
    phase === 'insecure'
      ? "The camera needs a secure page. Opened over Wi-Fi this address is plain http, so scanning is off here — type the code instead, or open the link your teacher sent."
      : phase === 'denied'
        ? 'The camera was not allowed. You can turn it back on in your browser settings, or type the code instead.'
        : phase === 'unavailable'
          ? 'No camera available on this device. Type the code instead.'
          : null

  return (
    <div className="space-y-4">
      {message ? (
        <p className="text-[13.5px] leading-snug" style={{ color: 'var(--clay-dim)' }}>{message}</p>
      ) : (
        <>
          <div
            className="relative mx-auto aspect-square w-full max-w-[300px] overflow-hidden"
            style={{ background: 'var(--clay-bg-deep)', borderRadius: 'var(--clay-r-md)' }}
          >
            <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
            {phase === 'starting' && (
              <p
                className="absolute inset-0 flex items-center justify-center text-[13px]"
                style={{ color: 'var(--clay-faint)' }}
              >
                Starting the camera…
              </p>
            )}
          </div>
          <p className="text-center text-[13px]" style={{ color: 'var(--clay-dim)' }}>
            Point it at the code on your teacher's screen.
          </p>
        </>
      )}

      <canvas ref={canvasRef} className="hidden" />

      <button
        type="button"
        onClick={onCancel}
        className="mx-auto block min-h-[40px] text-[13px] font-semibold"
        style={{ color: 'var(--clay-accent-ink)' }}
      >
        {message ? 'Back' : 'Cancel'}
      </button>
    </div>
  )
}
