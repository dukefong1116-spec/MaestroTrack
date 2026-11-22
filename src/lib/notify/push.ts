import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { auth } from '@/lib/firebase/config'
import { apiUrl, isNativeApp } from '@/lib/native'

/**
 * Notifications, the app's side: permission, this device's push address
 * (registered with the server, which sends pushes about other people's
 * actions), and reporting those actions. Scheduled reminders are in
 * lib/notify/plan and hooks/useReminders.
 *
 * iPhone app: Apple's notifications (FemataNotifyPlugin). Website: the
 * browser's Web Push, through the service worker (public/push-sw.js).
 */

export interface LocalItem {
  id: string
  kind: string
  title: string
  body: string
  /** ms since 1970 */
  at: number
  mood?: string
  url?: string
  passive?: boolean
}

interface NotifyPlugin {
  schedule(o: { items: LocalItem[] }): Promise<{ scheduled: number }>
  status(): Promise<{ status: Permission }>
  request(): Promise<{ status: Permission }>
  register(): Promise<void>
  addListener(e: 'token', fn: (d: { token: string; env: string }) => void): Promise<PluginListenerHandle>
}
const Native = registerPlugin<NotifyPlugin>('FemataNotify')

export type Permission = 'granted' | 'denied' | 'prompt' | 'unsupported'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
const webCapable = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window

/** Whether this device may show notifications, without asking. */
export async function notifyPermission(): Promise<Permission> {
  if (isNativeApp) return (await Native.status().catch(() => ({ status: 'unsupported' as Permission }))).status
  if (!webCapable()) return 'unsupported'
  return Notification.permission === 'default' ? 'prompt' : (Notification.permission as Permission)
}

/** Ask (shows the system prompt once), then register for pushes. */
export async function enableNotifications(): Promise<Permission> {
  let status: Permission
  if (isNativeApp) status = (await Native.request().catch(() => ({ status: 'denied' as Permission }))).status
  else if (!webCapable()) return 'unsupported'
  else status = (await Notification.requestPermission()) === 'granted' ? 'granted' : 'denied'
  if (status === 'granted') {
    void registerDevice()
    // Plans made before permission were never scheduled: replan now.
    window.dispatchEvent(new Event(GRANTED))
  }
  return status
}

/** Fired when notifications have just been allowed. */
export const GRANTED = 'femata:notify-granted'

/** Replace every scheduled reminder with these (iPhone app only). */
export async function scheduleReminders(items: LocalItem[]) {
  if (!isNativeApp) return
  await Native.schedule({ items }).catch(() => {})
}

/* ── this device's push address ──────────────────────────────────── */

const DEVICE_KEY = 'femata_device_id'
function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id) }
    return id
  } catch {
    return 'unknown'
  }
}

async function post(path: string, body: unknown): Promise<boolean> {
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) return false
  try {
    const res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify(body),
      keepalive: true,
    })
    return res.ok
  } catch {
    return false
  }
}

const tzOffset = () => -new Date().getTimezoneOffset()

let tokenHandle: Promise<PluginListenerHandle> | null = null

/**
 * Tell the server where to reach this device, for whoever is signed in.
 * Safe to repeat: the server keeps one entry per device, and hands a
 * device over when someone else signs in on it.
 */
export async function registerDevice(): Promise<void> {
  if ((await notifyPermission()) !== 'granted') return
  if (isNativeApp) {
    tokenHandle ??= Native.addListener('token', ({ token, env }) => {
      void post('/api/push/register', { deviceId: deviceId(), platform: 'ios', token, env, tzOffset: tzOffset() })
    })
    await tokenHandle
    await Native.register().catch(() => {})
    return
  }
  if (!VAPID) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription())
      ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64(VAPID) }))
    await post('/api/push/register', { deviceId: deviceId(), platform: 'web', token: JSON.stringify(sub), tzOffset: tzOffset() })
  } catch {
    // No push here (a private window, an old browser): the bell still works.
  }
}

/** Before signing out: this device stops receiving that account's pushes. */
export async function unregisterDevice(): Promise<void> {
  await post('/api/push/unregister', { deviceId: deviceId() })
}

/**
 * Something happened that someone else should hear about. The server
 * checks it really happened, and that you are the one who did it, before
 * telling anyone. Fire and forget: a push that does not go is never worth
 * failing the action that caused it.
 */
export type PushEvent =
  | 'assignment-new' | 'assignment-reviewed' | 'work-handed-in'
  | 'piece-from-teacher' | 'message' | 'join-request' | 'joined-studio'

export function notifyEvent(type: PushEvent, id: string) {
  void post('/api/push/event', { type, id })
}

function urlBase64(s: string): ArrayBuffer {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0)).buffer as ArrayBuffer
}
