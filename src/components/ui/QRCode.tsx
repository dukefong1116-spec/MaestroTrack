import { useEffect, useState } from 'react'

/**
 * A QR code, drawn as an SVG path.
 *
 * The encoder is imported on demand rather than at module load: it is the
 * largest thing on the invite sheet by some way, and the only screen that
 * wants it is one a teacher opens occasionally. Everyone else never
 * downloads it.
 *
 * Rendered as SVG rather than canvas so it stays sharp at any size and
 * prints properly — a teacher photographing or printing an invitation is
 * exactly the case this exists for.
 */
export default function QRCode({
  value,
  size = 200,
  className,
}: {
  value: string
  size?: number
  className?: string
}) {
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    setSvg(null)
    setFailed(false)

    import('qrcode')
      .then((qr) => qr.toString(value, {
        type: 'svg',
        margin: 1,
        // Medium recovery: enough to survive a phone camera at an angle
        // without inflating the module count so far it stops scanning.
        errorCorrectionLevel: 'M',
        color: { dark: '#1A1119', light: '#FFFFFF' },
      }))
      .then((out) => { if (live) setSvg(out) })
      .catch((e) => {
        console.error('[QRCode] could not render', e)
        if (live) setFailed(true)
      })

    return () => { live = false }
  }, [value])

  // The code is a convenience, never the only way in — the link and the
  // short code are both on the same sheet — so a failure here is a quiet
  // blank rather than an error anybody has to act on.
  if (failed) return null

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--clay-r-sm)',
        background: '#FFFFFF',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {svg && (
        <div
          style={{ width: '100%', height: '100%' }}
          // The encoder's own output: a <svg> with a single path, built
          // from a string this app generated. No user input reaches it.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  )
}
