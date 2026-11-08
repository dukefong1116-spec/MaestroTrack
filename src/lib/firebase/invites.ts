import {
  Timestamp, doc, getDoc, writeBatch,
} from 'firebase/firestore'
import { auth, db } from './config'
import type { InviteCode, StudioInvite, StudioRequest, UserProfile } from '@/types'

const INVITES = 'studioInvites'
const CODES = 'inviteCodes'
const REQUESTS = 'studioRequests'

/** How long an invitation stays usable. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Six characters, no I, O, 0 or 1 — the pairs a person reads out and the
 * other person mistypes. 32 letters over 6 places is about 1.07 billion,
 * and a code is single use, expiring, and worth only a request the
 * teacher still has to accept.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n))
}

/** 16 random bytes as base64url: 22 characters, safe in a URL unescaped. */
export function generateInviteToken(): string {
  const bytes = randomBytes(16)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Rejection sampling rather than `% 32`. The alphabet is exactly 32
 * letters so a modulo would in fact be uniform here, but the bias would
 * reappear silently the day somebody adds a letter.
 */
export function generateInviteCode(): string {
  const limit = 256 - (256 % CODE_ALPHABET.length)
  let out = ''
  while (out.length < 6) {
    for (const byte of randomBytes(8)) {
      if (out.length === 6) break
      if (byte >= limit) continue
      out += CODE_ALPHABET[byte % CODE_ALPHABET.length]
    }
  }
  return out
}

/**
 * The address a teacher sends, and what the QR encodes. Guarded on
 * `window` so it can be called from a test or any non-browser context
 * without throwing — the path is the part that matters.
 */
export function inviteUrl(token: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}/join/${token}`
}

export interface NewInvite {
  token: string
  code: string
  url: string
  expiresAt: Date
}

/**
 * Mint an invitation: one document for the link, one tiny pointer for the
 * spoken code. Written together, because a code pointing at an invite
 * that does not exist is worse than no code at all.
 */
export async function createInvite(profile: UserProfile): Promise<NewInvite> {
  if (profile.role !== 'teacher') throw new Error('Only a teacher can invite a student.')
  if (auth.currentUser?.uid !== profile.uid) throw new Error('Sign in again before inviting a student.')

  const token = generateInviteToken()
  const code = generateInviteCode()
  const expiresAt = Timestamp.fromMillis(Date.now() + INVITE_TTL_MS)

  const batch = writeBatch(db)
  batch.set(doc(db, INVITES, token), {
    teacherId: profile.uid,
    teacherName: profile.displayName ?? '',
    studioName: profile.studioName ?? '',
    createdAt: new Date().toISOString(),
    expiresAt,
    status: 'open',
  })
  batch.set(doc(db, CODES, code), { token, teacherId: profile.uid, expiresAt })
  await batch.commit()

  return { token, code, url: inviteUrl(token), expiresAt: expiresAt.toDate() }
}

function readInvite(token: string, data: Record<string, unknown>): StudioInvite {
  const raw = data.expiresAt
  return {
    token,
    teacherId: String(data.teacherId ?? ''),
    teacherName: String(data.teacherName ?? ''),
    studioName: String(data.studioName ?? ''),
    createdAt: String(data.createdAt ?? ''),
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
    expiresAt: raw instanceof Timestamp ? raw.toDate() : new Date(0),
    status: (data.status as StudioInvite['status']) ?? 'revoked',
  }
}

export type InviteProblem = 'not-found' | 'expired' | 'claimed' | 'revoked'

export interface InviteLookup {
  invite: StudioInvite | null
  problem: InviteProblem | null
}

/**
 * Fetch an invitation, saying why it cannot be used rather than only
 * that it cannot. "This invitation has already been used" and "no such
 * invitation" send a person to different places.
 */
export async function getInvite(token: string): Promise<InviteLookup> {
  const clean = token.trim()
  if (!clean) return { invite: null, problem: 'not-found' }

  const snap = await getDoc(doc(db, INVITES, clean))
  if (!snap.exists()) return { invite: null, problem: 'not-found' }

  const invite = readInvite(snap.id, snap.data())
  if (invite.status === 'claimed') return { invite, problem: 'claimed' }
  if (invite.status === 'revoked') return { invite, problem: 'revoked' }
  if (invite.expiresAt.getTime() <= Date.now()) return { invite, problem: 'expired' }
  return { invite, problem: null }
}

/** Resolve a spoken code to its invitation. Needs a signed-in reader. */
export async function resolveInviteCode(code: string): Promise<InviteLookup> {
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (clean.length !== 6) return { invite: null, problem: 'not-found' }

  const snap = await getDoc(doc(db, CODES, clean))
  if (!snap.exists()) return { invite: null, problem: 'not-found' }

  const pointer = snap.data() as Pick<InviteCode, 'token'>
  return getInvite(pointer.token)
}

/** The deterministic request id — see the StudioRequest docstring. */
export function requestId(studentId: string, teacherId: string): string {
  return `${studentId}_${teacherId}`
}

/**
 * Ask to join, and spend the invitation doing it.
 *
 * Both writes go in one batch. Rules see the state as it was before the
 * batch, so the request's create rule still finds the invitation open
 * while the other half of the same batch is closing it.
 *
 * Note what this does *not* do: it does not touch the student's profile.
 * Joining is now the teacher's write, not the student's.
 */
export async function requestToJoin(
  profile: UserProfile,
  invite: StudioInvite
): Promise<StudioRequest> {
  if (auth.currentUser?.uid !== profile.uid) throw new Error('Sign in again before joining a studio.')
  if (profile.role !== 'student') throw new Error('Only a student account can join a studio.')
  if (profile.teacherId) throw new Error('You are already in a studio. Ask your teacher to remove you first.')

  const id = requestId(profile.uid, invite.teacherId)
  const request: StudioRequest = {
    id,
    studentId: profile.uid,
    teacherId: invite.teacherId,
    studentName: profile.displayName ?? '',
    instrument: profile.instrument,
    inviteToken: invite.token,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }

  const batch = writeBatch(db)
  const { id: _omit, instrument, ...fields } = request
  batch.set(doc(db, REQUESTS, id), instrument ? { ...fields, instrument } : fields)
  batch.update(doc(db, INVITES, invite.token), {
    status: 'claimed',
    updatedAt: new Date().toISOString(),
  })
  await batch.commit()

  return request
}

/** Burn an invitation that was sent to the wrong person. */
export async function revokeInvite(token: string): Promise<void> {
  if (!auth.currentUser) throw new Error('You are not signed in.')
  const batch = writeBatch(db)
  batch.update(doc(db, INVITES, token), { status: 'revoked', updatedAt: new Date().toISOString() })
  await batch.commit()
}
