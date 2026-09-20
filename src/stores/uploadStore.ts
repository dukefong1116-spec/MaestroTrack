import { create } from 'zustand'
import { uploadRecording } from '@/lib/firebase/recordings'
import { listClips, deleteClip, type PendingClip } from '@/lib/storage/pendingClips'

/**
 * Drains the pending-clip queue in the background.
 *
 * Uploads used to run inside `finish()`, in parallel, with no progress
 * reporting — so ending a session with a take meant staring at "Saving…"
 * while tens of megabytes went up, even though the session row itself had
 * been written in under a second.
 *
 * Now the session finishes immediately and this drains afterwards:
 *
 *  - serial, because several large takes on one uplink make each other
 *    slow and a wobble fails all of them at once
 *  - with progress, because a two-minute upload and a crash look identical
 *    otherwise
 *  - reading from IndexedDB, so a closed tab or a flat battery resumes on
 *    the next visit instead of losing the take
 */

interface UploadState {
  /** Clips still owed, refreshed from IndexedDB. */
  pending: PendingClip[]
  /** The clip currently going up, if any. */
  currentId: string | null
  /** 0–100 for the current clip. */
  progress: number
  uploading: boolean
  /** Clips that failed this run; retried on the next drain. */
  failed: string[]
  refresh: (userId: string) => Promise<void>
  drain: (userId: string) => Promise<void>
}

export const useUploadStore = create<UploadState>((set, get) => ({
  pending: [],
  currentId: null,
  progress: 0,
  uploading: false,
  failed: [],

  refresh: async (userId) => {
    set({ pending: await listClips(userId) })
  },

  drain: async (userId) => {
    // One drain at a time. A second call while uploading would send the
    // same clip twice and duplicate the recording.
    if (get().uploading) return

    const queue = await listClips(userId)
    if (queue.length === 0) {
      set({ pending: [], uploading: false, currentId: null, progress: 0 })
      return
    }

    set({ uploading: true, pending: queue, failed: [] })

    for (const clip of queue) {
      // A clip whose session never got saved has nothing to attach to yet.
      if (!clip.sessionId) continue

      set({ currentId: clip.id, progress: 0 })
      try {
        const file = new File([clip.blob], `session-${clip.createdAt}.${clip.ext}`, {
          type: clip.blob.type,
        })
        await uploadRecording(
          userId,
          file,
          {
            pieceName: clip.pieceName,
            date: clip.date,
            notes: clip.notes,
            duration: clip.seconds,
            sessionId: clip.sessionId,
          },
          (pct) => set({ progress: Math.round(pct) })
        )
        // Only now is it safe to forget: the Firestore row exists.
        await deleteClip(clip.id)
        set((s) => ({ pending: s.pending.filter((c) => c.id !== clip.id) }))
      } catch {
        // Keep it on disk and try again next time rather than dropping it.
        set((s) => ({ failed: [...s.failed, clip.id] }))
      }
    }

    set({ uploading: false, currentId: null, progress: 0 })
    await get().refresh(userId)
  },
}))
