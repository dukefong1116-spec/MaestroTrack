import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { isNativeApp } from '@/lib/native'
import { haptic } from '@/lib/haptics'

/**
 * The iPhone app's tab bar is Apple's own (ios/App/App/NativeTabBar.swift):
 * a UIKit tab bar gets Liquid Glass — the lensing glass, the selection that
 * magnifies and slides under a dragging finger — from the system, which is
 * how Apple asks apps to adopt it. This drives it from the web app: which
 * tabs, which is lit, when it shows, and where a tap goes.
 */
export interface NativeTab { id: string; title: string; symbol: string; badge?: string }

interface NativeTabBarPlugin {
  configure(opts: { items: NativeTab[]; selected?: string; tint?: string }): Promise<void>
  select(opts: { id?: string }): Promise<void>
  setVisible(opts: { visible: boolean }): Promise<void>
  addListener(event: 'select', fn: (e: { id: string }) => void): Promise<PluginListenerHandle>
}

const NativeTabBar = registerPlugin<NativeTabBarPlugin>('NativeTabBar')

/** SF Symbols for each destination, as the system's own apps draw them. */
export const SYMBOLS: Record<string, string> = {
  '/teacher': 'sun.max',
  '/teacher/calendar': 'calendar',
  '/teacher/students': 'person.2',
  '/teacher/review': 'checklist',
  '/teacher/more': 'ellipsis',
  '/student': 'square.grid.2x2',
  '/student/practice': 'metronome',
  '/student/library': 'books.vertical',
  '/student/league': 'trophy',
  '/student/studio': 'graduationcap',
  '/student/settings': 'gearshape',
}

/**
 * tabs: each with the route it opens (its id), a title and a badge.
 * current: the tab lit for this page, or undefined for a page that is not
 * one of them. visible: whether the bar shows on this page.
 */
export function useNativeTabBar(tabs: { to: string; title: string; badge?: string }[], current: string | undefined, visible: boolean) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const items = useMemo<NativeTab[]>(
    () => tabs.map((t) => ({ id: t.to, title: t.title, symbol: SYMBOLS[t.to] ?? 'circle', badge: t.badge })),
    [tabs],
  )
  const key = JSON.stringify(items)
  const selected = useRef(current)
  selected.current = current

  // The tabs themselves (and their badges).
  useEffect(() => {
    if (!isNativeApp) return
    void NativeTabBar.configure({ items, selected: selected.current, tint: '#1F8FD1' }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Which one is lit, as the page changes.
  useEffect(() => {
    if (!isNativeApp) return
    void NativeTabBar.select({ id: current }).catch(() => {})
  }, [current, pathname])

  useEffect(() => {
    if (!isNativeApp) return
    void NativeTabBar.setVisible({ visible }).catch(() => {})
  }, [visible])

  // A tap on the bar opens that tab.
  useEffect(() => {
    if (!isNativeApp) return
    let handle: PluginListenerHandle | undefined
    let live = true
    void NativeTabBar.addListener('select', (e) => { haptic('select'); navigate(e.id) }).then((h) => {
      if (live) handle = h
      else void h.remove()
    })
    return () => { live = false; void handle?.remove() }
  }, [navigate])

  // Signing out, or leaving the app's pages: no bar.
  useEffect(() => () => { if (isNativeApp) void NativeTabBar.setVisible({ visible: false }).catch(() => {}) }, [])
}
