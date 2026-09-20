import { create } from 'zustand'
import { uploadRecording } from '@/lib/firebase/recordings'
import { listClips, deleteClip, type PendingClip } from '@/lib/storage/pendingClips'

/**
 * A clip with no session has nothing to attach to. That is normal while a
 * session is still running, and abandoned once it clearly is not — there is
 * no other signal, so age is the one available. Anything older than this
 * belonged to a session that never got saved.
 */
const ORPHAN_MAX_AGE_MS = 24 * 60 * 60 * 1000

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

/**
 * Only ever one of these, and each means exactly what it says. An earlier
 * version showed "Uploading…" whenever anything at all sat in the queue,
 * which meant a clip that could never be uploaded — its session was never
 * saved — displayed "Uploading… 0%" permanently. A progress indicator that
 * cannot distinguish working from stuck is worse than none.
 */
export type UploadStatus =
  | 'idle'       // nothing owed
  | 'uploading'  // bytes are moving right now
  | 'waiting'    // owed, but no attempt in flight
  | 'stalled'    // attempted and failed; will retry

interface UploadState {
  /** Clips owed to a *saved* session — the only ones that can be uploaded. */
  pending: UploadableClip[]
  /** The clip currently going up, if any. */
  currentId: string | null
  /** 0–100 for the current clip. Null until the first progress event. */
  progress: number | null
  uploading: boolean
  /** Clips that failed this run; retried on the next drain. */
  failed: string[]
  status: () => UploadStatus
  refresh: (userId: string) => Promise<void>
  drain: (userId: string) => Promise<void>
}

export const useUploadStore = create<UploadState>((set, get) => ({
  pending: [],
  currentId: null,
  progress: null,
  uploading: false,
  failed: [],

  status: () => {
    const { pending, uploading, failed } = get()
    if (pending.length === 0) return 'idle'
    if (uploading) return 'uploading'
    return failed.length > 0 ? 'stalled' : 'waiting'
  },

  refresh: async (userId) => {
    set({ pending: await uploadable(userId) })
  },

  drain: async (userId) => {
    // One drain at a time. A second call while uploading would send the
    // same clip twice and duplicate the recording.
    if (get().uploading) return

    await sweepOrphans(userId)

    const queue = await uploadable(userId)
    if (queue.length === 0) {
      set({ pending: [], uploading: false, currentId: null, progress: null })
      return
    }

    set({ uploading: true, pending: queue, failed: [] })

    for (const clip of queue) {
      set({ currentId: clip.id, progress: null })
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
          // Null until the first real event: showing 0% before anything has
          // happened reads as stuck rather than starting.
          (pct) => set({ progress: Math.round(pct) })
        )
        // Only now is it safe to forget: the Firestore row exists.
        await deleteClip(clip.id)
        set((s) => ({ pending: s.pending.filter((c) => c.id !== clip.id) }))
      } catch {
        // Keep it on disk and try again next time rather than dropping it.
        // A set, not a list: React runs mount effects twice in development,
        // so the same clip could otherwise be recorded as failed twice.
        set((s) => ({ failed: s.failed.includes(clip.id) ? s.failed : [...s.failed, clip.id] }))
      }
    }

    set({ uploading: false, currentId: null, progress: null })
    await get().refresh(userId)
  },
}))

/** A clip that can actually be sent: the session it belongs to exists. */
type UploadableClip = PendingClip & { sessionId: string }

function isUploadable(c: PendingClip): c is UploadableClip {
  return typeof c.sessionId === 'string' && c.sessionId.length > 0
}

async function uploadable(userId: string): Promise<UploadableClip[]> {
  return (await listClips(userId)).filter(isUploadable)
}

/**
 * Discards clips whose session was never saved and never will be. Without
 * this they accumulate silently and, because they were counted as pending,
 * left the indicator claiming an upload that could never happen.
 */
async function sweepOrphans(userId: string): Promise<void> {
  const cutoff = Date.now() - ORPHAN_MAX_AGE_MS
  for (const clip of await listClips(userId)) {
    if (!clip.sessionId && clip.createdAt < cutoff) await deleteClip(clip.id)
  }
}
