import { create } from 'zustand'
import type { User } from 'firebase/auth'
import type { UserProfile } from '@/types'

interface AuthState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  /**
   * The profile came from the server this visit. False while the app is
   * showing the copy saved on this device — fine to look at, never to act
   * on: anything that writes on its own waits for this.
   */
  profileLive: boolean
  setProfileLive: (live: boolean) => void
  /**
   * Showing the last account used on this device while Firebase has not
   * yet said who is signed in. It stands in for `user` at the door (see
   * ProtectedRoute) and ends the moment Firebase answers, either way.
   */
  provisional: boolean
  setProvisional: (provisional: boolean) => void
  setUser: (user: User | null) => void
  setProfile: (profile: UserProfile | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  profileLive: false,
  setProfileLive: (profileLive) => set({ profileLive }),
  provisional: false,
  setProvisional: (provisional) => set({ provisional }),
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
}))
