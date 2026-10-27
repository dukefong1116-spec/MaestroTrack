import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { logOut } from '@/lib/firebase/auth'

/**
 * On a phone the sidebar is gone, and it held the only Log Out in the app.
 * This puts it back — at the bottom of Settings rather than in the tab bar,
 * because signing out should be a decision rather than something a thumb
 * can do by accident. Hidden from `lg` up, where the sidebar's own button
 * is back and this would be a duplicate.
 */
export default function MobileLogOut() {
  const navigate = useNavigate()

  async function handleLogout() {
    await logOut()
    navigate('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-transform active:scale-[.98] lg:hidden"
      style={{ background: 'var(--clay-surface)', color: 'var(--clay-danger)', boxShadow: 'var(--clay-raised)' }}
    >
      <LogOut size={16} /> Log Out
    </button>
  )
}
