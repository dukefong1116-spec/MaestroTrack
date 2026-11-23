import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { useHoldCover } from '@/stores/momentStore'
import { haptic } from '@/lib/haptics'

/**
 * Cropping a picture before it is used: a profile photo (square, shown in
 * a circle) or a banner (wide). The frame's shape is fixed by `aspect`, so
 * a banner is always cut wide and a photo always square — whatever shape
 * the picture was taken in.
 *
 * Drag to move, pinch (or the slider, or a mouse wheel) to zoom. The
 * picture always covers the frame: it cannot be moved or zoomed out so far
 * that an empty edge would be saved.
 */
export default function ImageCropper({ file, aspect, round, outputWidth, title, onCancel, onDone }: {
  file: File
  /** Width ÷ height of the frame: 1 for a photo, 2 for a banner. */
  aspect: number
  /** Show the frame as a circle (a profile photo). The saved picture is still square. */
  round?: boolean
  /** Pixels wide of the saved picture. */
  outputWidth: number
  title: string
  onCancel: () => void
  onDone: (cropped: File) => void
}) {
  useHoldCover(true)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [url, setUrl] = useState('')
  // Made and released together, so the picture's address is never let go
  // while the image is still loading from it.
  useEffect(() => {
    const u = URL.createObjectURL(file)
    let live = true
    const i = new Image()
    i.onload = () => { if (live) { setUrl(u); setImg(i) } }
    i.src = u
    return () => { live = false; URL.revokeObjectURL(u) }
  }, [file])

  // The frame, sized to the screen.
  const stage = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState({ w: 300, h: 300 })
  useLayoutEffect(() => {
    const fit = () => {
      const r = stage.current?.getBoundingClientRect()
      if (!r) return
      const maxW = Math.min(r.width - 32, 560)
      const maxH = r.height - 32
      const w = Math.min(maxW, maxH * aspect)
      setFrame({ w, h: w / aspect })
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [aspect])

  // Zoom 1 = the picture just covers the frame. Offsets are in screen
  // pixels from centred.
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const cover = img ? Math.max(frame.w / img.naturalWidth, frame.h / img.naturalHeight) : 1
  const scale = cover * zoom
  const shownW = img ? img.naturalWidth * scale : 0
  const shownH = img ? img.naturalHeight * scale : 0
  const clamp = (o: { x: number; y: number }, w = shownW, h = shownH) => ({
    x: Math.max(-(w - frame.w) / 2, Math.min((w - frame.w) / 2, o.x)),
    y: Math.max(-(h - frame.h) / 2, Math.min((h - frame.h) / 2, o.y)),
  })
  const zoomTo = (z: number) => {
    const next = Math.max(1, Math.min(4, z))
    setZoom(next)
    if (img) setOff((o) => clamp(o, img.naturalWidth * cover * next, img.naturalHeight * cover * next))
  }

  // Drag with one finger, pinch with two.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)
  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom }
    }
  }
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      zoomTo(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist))
    } else if (pointers.current.size === 1) {
      setOff((o) => clamp({ x: o.x + e.clientX - prev.x, y: o.y + e.clientY - prev.y }))
    }
  }
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  async function done() {
    if (!img) return
    haptic('success')
    // The part of the original picture inside the frame.
    const sx = (shownW / 2 - frame.w / 2 - off.x) / scale
    const sy = (shownH / 2 - frame.h / 2 - off.y) / scale
    const sw = frame.w / scale
    const sh = frame.h / scale
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(outputWidth)
    canvas.height = Math.round(outputWidth / aspect)
    const ctx = canvas.getContext('2d')
    if (!ctx) return onDone(file)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
    onDone(blob ? new File([blob], 'cropped.jpg', { type: 'image/jpeg' }) : file)
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-black text-white" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <p className="py-3 text-center text-[15px] font-semibold">{title}</p>
      <div
        ref={stage}
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={(e) => zoomTo(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
      >
        {img && url && (
          <img
            src={url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
            style={{ width: shownW, height: shownH, transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px))` }}
          />
        )}
        {/* The frame: everything outside it dimmed, its shape fixed. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: frame.w,
            height: frame.h,
            borderRadius: round ? '50%' : 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,.62)',
            outline: '2px solid rgba(255,255,255,.9)',
          }}
        />
      </div>
      <div className="flex items-center gap-3 px-6 py-3">
        <ZoomOut size={18} className="shrink-0 opacity-70" />
        <input
          type="range" min={1} max={4} step={0.01} value={zoom}
          onChange={(e) => zoomTo(Number(e.target.value))}
          aria-label="Zoom"
          className="min-w-0 flex-1 accent-white"
        />
        <ZoomIn size={18} className="shrink-0 opacity-70" />
      </div>
      <div className="flex items-center justify-between px-6 pb-3 pt-1 text-[17px]">
        <button type="button" onClick={onCancel} className="py-2">Cancel</button>
        <button type="button" onClick={() => void done()} disabled={!img} className="py-2 font-semibold disabled:opacity-40">Done</button>
      </div>
    </div>,
    document.body,
  )
}
