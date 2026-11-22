import { useRef } from 'react'
import { Plus } from 'lucide-react'
import { useNativeGlassButton } from '@/lib/nativeGlass'
import { haptic } from '@/lib/haptics'

/**
 * The round + that adds things, floating bottom right — the same one the
 * calendar has. In the iPhone app it is Apple's own glass button (see
 * nativeGlass); `visible` false steps it aside while a form is open.
 */
export default function AddFab({ id, label, visible = true, onAdd }: {
  id: string
  label: string
  visible?: boolean
  onAdd: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const add = () => { haptic('tap'); onAdd() }
  const native = useNativeGlassButton(ref, { id, symbol: 'plus', prominent: true, tint: '#1F8FD1', label, visible }, add)
  if (!visible) return null
  return (
    <button
      ref={ref}
      type="button"
      onClick={add}
      aria-label={label}
      aria-hidden={native || undefined}
      tabIndex={native ? -1 : undefined}
      className="glass glass-tint fixed right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full transition-transform active:scale-95 lg:right-6"
      style={{ bottom: 'calc(92px + env(safe-area-inset-bottom))', visibility: native ? 'hidden' : undefined }}
    >
      <Plus size={26} strokeWidth={2.4} aria-hidden="true" />
    </button>
  )
}
