import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { isNativeApp } from '@/lib/native'

/**
 * Apple's own Liquid Glass controls in the iPhone app (NativeGlassPlugin in
 * ios/App/App/NativeTabBar.swift), the same way the tab bar is native: the
 * web control stays where it is, invisible, and the real one is laid over
 * it. Outside the app these hooks do nothing and the web control shows.
 */
interface Frame { x: number; y: number; width: number; height: number }
interface NativeGlass {
  button(o: Frame & { id: string; symbol?: string; title?: string; prominent?: boolean; tint?: string; label?: string }): Promise<void>
  segmented(o: Frame & { id: string; items: string[]; selected: number; tint?: string }): Promise<void>
  remove(o: { id: string }): Promise<void>
  addListener(e: 'tap', fn: (d: { id: string }) => void): Promise<PluginListenerHandle>
  addListener(e: 'change', fn: (d: { id: string; index: number }) => void): Promise<PluginListenerHandle>
}
const Glass = registerPlugin<NativeGlass>('NativeGlass')

function frameOf(el: HTMLElement): Frame {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, width: r.width, height: r.height }
}

/** Keeps `send` called with the element's frame while `on`, and removes the control after. */
function useFollow(id: string, ref: RefObject<HTMLElement | null>, on: boolean, send: (f: Frame) => void, key: string) {
  const sendRef = useRef(send)
  sendRef.current = send
  useLayoutEffect(() => {
    const el = ref.current
    if (!on || !el) return
    let frame = 0
    const push = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => sendRef.current(frameOf(el))) }
    push()
    const ro = new ResizeObserver(push)
    ro.observe(el)
    window.addEventListener('resize', push)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      window.removeEventListener('resize', push)
      void Glass.remove({ id }).catch(() => {})
    }
  }, [id, ref, on, key])
}

function useListener<E extends 'tap' | 'change'>(event: E, on: boolean, fn: (d: { id: string; index?: number }) => void) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    if (!on) return
    let handle: PluginListenerHandle | undefined
    let live = true
    void (Glass.addListener as (e: string, f: (d: { id: string; index?: number }) => void) => Promise<PluginListenerHandle>)(event, (d) => fnRef.current(d))
      .then((h) => { if (live) handle = h; else void h.remove() })
    return () => { live = false; void handle?.remove() }
  }, [event, on])
}

/**
 * A glass button over `ref`'s element. Returns true when the native one is
 * showing, so the caller can hide its own (keeping its place in the layout).
 */
export function useNativeGlassButton(
  ref: RefObject<HTMLElement | null>,
  opts: { id: string; symbol?: string; title?: string; prominent?: boolean; tint?: string; label?: string; visible: boolean },
  onTap: () => void,
): boolean {
  const on = isNativeApp && opts.visible
  const { id, symbol, title, prominent, tint, label } = opts
  useFollow(id, ref, on, (f) => { void Glass.button({ ...f, id, symbol, title, prominent, tint, label }).catch(() => {}) }, `${symbol}|${title}|${prominent}|${tint}`)
  useListener('tap', on, (d) => { if (d.id === id) onTap() })
  return on
}

/** A glass bar holding Apple's segmented control, over `ref`'s element. */
export function useNativeSegmented(
  ref: RefObject<HTMLElement | null>,
  opts: { id: string; items: string[]; selected: number; tint?: string; visible: boolean },
  onChange: (index: number) => void,
): boolean {
  const on = isNativeApp && opts.visible
  const { id, items, selected, tint } = opts
  const [, force] = useState(0)
  useFollow(id, ref, on, (f) => { void Glass.segmented({ ...f, id, items, selected, tint }).catch(() => {}) }, `${items.join('|')}#${selected}#${tint}`)
  useListener('change', on, (d) => { if (d.id === id && typeof d.index === 'number') { onChange(d.index); force((n) => n + 1) } })
  return on
}
