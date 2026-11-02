/**
 * Says which Firebase this build is talking to.
 *
 * Only ever rendered in a dev build connected to the emulator suite, so it
 * cannot reach production: `import.meta.env.DEV` is false in any built
 * bundle, and the flag is set by `dev:emulator` / `dev:mobile` alone.
 *
 * It exists because the failure it prevents is silent and expensive. Both
 * emulator dev servers bind port 5174, the production one binds 5173, and
 * the app looks identical either way — so signing in with a real account
 * against the emulator just reports "invalid email or password", which
 * reads as a broken account rather than the wrong backend. That cost real
 * time more than once.
 */
export default function BackendBadge() {
  const onEmulator = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === '1'
  if (!onEmulator) return null

  return (
    <div
      // Bottom-left, clear of the tab bar — at bottom-2 it sat on top of
      // the Practice label on a phone. The bell owns the top-right.
      className="pointer-events-none fixed left-2 z-[100] select-none rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
      // calc keeps it above the bar plus the home-indicator inset.
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)', background: '#8A1B1B', color: '#fff', opacity: 0.85 }}
      title="This build talks to the local Firebase emulator, not your real project. Accounts here are not your real accounts."
    >
      Emulator
    </div>
  )
}
