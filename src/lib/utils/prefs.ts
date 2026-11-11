import type { AccentName, NotifyKind, ThemeChoice, UserProfile } from '@/types'

export type { AccentName, NotifyKind, ThemeChoice }

/**
 * Everything the Appearance and Notifications screens control.
 *
 * The profile is the source of truth, so a preference follows you to
 * another device. localStorage mirrors it only so the theme can be applied
 * before React mounts — otherwise every load flashes light before settling.
 * Sound is deliberately NOT here: it stays per-device, for the reason
 * SoundSetting already gives.
 */

export interface Prefs {
  theme: ThemeChoice
  accent: AccentName
  /** Percent. 100 is the app's own sizing. */
  displayScale: number
  reduceMotion: boolean
  notify: Record<NotifyKind, boolean>
  reminderEnabled: boolean
  /** "HH:mm", 24-hour. */
  reminderTime: string
}

export const DEFAULT_PREFS: Prefs = {
  // Light, not 'system': the app is designed light and that is what a new
  // account should see. Following the OS is still a choice on the
  // Appearance screen, just no longer the one nobody made.
  theme: 'light',
  accent: 'instrument',
  displayScale: 100,
  reduceMotion: false,
  notify: { assignments: true, feedback: true, lessons: true, submissions: true, nudges: true, league: true },
  reminderEnabled: false,
  reminderTime: '18:00',
}

export const SCALES = [90, 100, 110, 125] as const

/**
 * `instrument` is the default and means "leave it as it is": coral for
 * controls, the instrument's own colour for the hero, rings and bars.
 * Anything else replaces BOTH — one colour the person chose, with the
 * instrument surviving as its icon and the avatar gradient.
 */
export const ACCENTS: Record<Exclude<AccentName, 'instrument'>, {
  label: string; accent: string; hover: string; soft: string; ink: string; rgb: string
}> = {
  coral:  { label: 'Coral',  accent: '#FF7A5C', hover: '#F26243', soft: '#FFEDE7', ink: '#E05539', rgb: '255,122,92' },
  indigo: { label: 'Indigo', accent: '#6C6AE8', hover: '#5755D4', soft: '#ECEBFD', ink: '#4441C9', rgb: '108,106,232' },
  teal:   { label: 'Teal',   accent: '#2FA98C', hover: '#248A72', soft: '#E4F6F1', ink: '#1F7A64', rgb: '47,169,140' },
  amber:  { label: 'Amber',  accent: '#E8A33D', hover: '#CE8B28', soft: '#FDF0DC', ink: '#9A6412', rgb: '232,163,61' },
  rose:   { label: 'Rose',   accent: '#F2698F', hover: '#DC5077', soft: '#FDE9EF', ink: '#C43A63', rgb: '242,105,143' },
  slate:  { label: 'Slate',  accent: '#6B7A99', hover: '#586584', soft: '#ECEFF5', ink: '#48546E', rgb: '107,122,153' },
}

const KEY = 'maestro_prefs'

type RawPrefs = Partial<Omit<Prefs, 'notify'>> & { notify?: Partial<Prefs['notify']> }

function clean(raw: RawPrefs | null | undefined): Prefs {
  if (!raw) return DEFAULT_PREFS
  return {
    theme: raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system' ? raw.theme : DEFAULT_PREFS.theme,
    accent: raw.accent && (raw.accent === 'instrument' || raw.accent in ACCENTS) ? raw.accent : DEFAULT_PREFS.accent,
    displayScale: SCALES.includes(raw.displayScale as typeof SCALES[number]) ? raw.displayScale! : DEFAULT_PREFS.displayScale,
    reduceMotion: typeof raw.reduceMotion === 'boolean' ? raw.reduceMotion : DEFAULT_PREFS.reduceMotion,
    notify: { ...DEFAULT_PREFS.notify, ...(raw.notify ?? {}) },
    reminderEnabled: typeof raw.reminderEnabled === 'boolean' ? raw.reminderEnabled : DEFAULT_PREFS.reminderEnabled,
    reminderTime: /^\d{2}:\d{2}$/.test(raw.reminderTime ?? '') ? raw.reminderTime! : DEFAULT_PREFS.reminderTime,
  }
}

/** Bumped only if a stored shape ever has to be reinterpreted. */
export const PREFS_VERSION = 1

/**
 * The prefs a profile carries, with anything missing or invalid defaulted.
 *
 * `theme` is ignored unless the profile has been through the Appearance
 * screen. Signup has always written `theme: 'dark'` into every account
 * while nothing read it, so honouring that stored value would have turned
 * the whole user base dark the day this shipped — which is a thing that
 * happened in testing, not a thing that was guessed at.
 */
export function prefsFromProfile(profile: UserProfile | null | undefined): Prefs {
  if (!profile) return readCachedPrefs()
  const chosen = profile.prefsVersion === PREFS_VERSION
  return clean({
    theme: chosen ? (profile.theme as ThemeChoice | undefined) : undefined,
    accent: profile.accent,
    displayScale: profile.displayScale,
    reduceMotion: profile.reduceMotion,
    notify: profile.notify,
    reminderEnabled: profile.reminderEnabled,
    reminderTime: profile.reminderTime,
  })
}

export function readCachedPrefs(): Prefs {
  try {
    return clean(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return DEFAULT_PREFS
  }
}

export function cachePrefs(p: Prefs): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* private mode */ }
}

/**
 * The instrument colours the rest of the app reads through `getTheme`.
 *
 * A module-level override rather than an extra argument on `getTheme`:
 * every caller already goes through that one function, and threading a
 * preference through six call sites would be a bigger change than the
 * feature. `sound.ts` reads its mute preference the same way.
 */
let themeOverride: { primary: string; secondary: string } | null = null
export function accentThemeOverride() { return themeOverride }

/**
 * Whether the app is currently dark — by choice or by the system setting.
 * Read at render time by anything that has to pick a colour in JS rather
 * than in CSS, which is only the instrument tints.
 */
export function isDarkTheme(): boolean {
  if (typeof document === 'undefined') return false
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'dark') return true
  if (chosen === 'light') return false
  return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

/** Mixes two hex colours. `t` of 0 returns `a`, 1 returns `b`. */
function mix(a: string, b: string, t: number): string {
  const parse = (h: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h.trim())
    return m ? parseInt(m[1], 16) : 0
  }
  const x = parse(a), y = parse(b)
  const ch = (sh: number) => Math.round((((x >> sh) & 255) * (1 - t)) + (((y >> sh) & 255) * t))
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}

const DARK_GROUND = '#15121E'

/** Puts a set of preferences into effect. Safe to call repeatedly. */
export function applyPrefs(p: Prefs): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  root.dataset.theme = p.theme === 'system' ? '' : p.theme
  if (p.theme === 'system') delete root.dataset.theme

  root.dataset.motion = p.reduceMotion ? 'reduce' : ''
  if (!p.reduceMotion) delete root.dataset.motion

  root.style.setProperty('--clay-zoom', String(p.displayScale / 100))

  // The browser chrome sits right against the app; leaving it on the light
  // value puts a pale bar above a dark screen.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', isDarkTheme() ? '#15121E' : '#F1ECF8')

  if (p.accent === 'instrument') {
    themeOverride = null
    for (const v of ['--clay-accent', '--clay-accent-hover', '--clay-accent-soft', '--clay-accent-ink', '--clay-on-accent', '--clay-accent-shadow']) {
      root.style.removeProperty(v)
    }
  } else {
    const a = ACCENTS[p.accent]
    const dark = isDarkTheme()
    themeOverride = { primary: a.accent, secondary: a.hover }

    // The stored soft and ink are chosen for a light ground. After dark
    // they have to swap roles: the tint sinks toward the background and
    // the text colour rises, or a chosen accent leaves pale chips glowing
    // in a dark app while every untouched one behaves.
    root.style.setProperty('--clay-accent', a.accent)
    root.style.setProperty('--clay-accent-hover', a.hover)
    root.style.setProperty('--clay-accent-soft', dark ? mix(a.accent, DARK_GROUND, 0.82) : a.soft)
    root.style.setProperty('--clay-accent-ink', dark ? mix(a.accent, '#FFFFFF', 0.35) : a.ink)
    root.style.setProperty('--clay-on-accent', dark ? '#1A1119' : '#FFFFFF')
    root.style.setProperty(
      '--clay-accent-shadow',
      dark
        ? `0 10px 22px -6px rgba(${a.rgb},.30), inset 0 1px 0 rgba(255,255,255,.16)`
        : `0 10px 22px -6px rgba(${a.rgb},.45), inset 0 2px 0 rgba(255,255,255,.45)`
    )
  }
}
