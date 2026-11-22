/**
 * Who last signed in on this device, for the sign-in screen's "Last signed
 * in as …". Only on this device (localStorage), and only the name, email
 * and photo — never anything to sign in with.
 */
export interface LastLogin { email: string; name?: string; avatar?: string; instrument?: string }
const KEY = 'femata_last_login'

export function rememberLogin(l: LastLogin) {
  try { localStorage.setItem(KEY, JSON.stringify(l)) } catch { /* fine without it */ }
}
export function lastLogin(): LastLogin | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return v && typeof v.email === 'string' ? v : null
  } catch { return null }
}
export function forgetLogin() {
  try { localStorage.removeItem(KEY) } catch { /* fine */ }
}
