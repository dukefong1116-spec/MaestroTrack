/**
 * POST /api/push/event — "I just did this; tell whoever it is for."
 * Body: { type, id }.
 *
 * Nothing in the body is believed. The document is read here, and the push
 * only goes if it exists, is fresh, the caller is the one who made it, and
 * the person told is the one it is for — so no one can push words of their
 * choosing at anybody, or replay an old event to nag someone.
 */
import { handler, callerUid, jsonBody, db, HttpError } from '../_lib/admin.js'
import { sendToUser, firstName, clip } from '../_lib/push.js'

/** An event older than this is not news; refused rather than sent late. */
const FRESH_MS = 10 * 60_000
const fresh = (iso) => Boolean(iso) && Date.now() - new Date(iso).getTime() < FRESH_MS

async function get(path) {
  const snap = await db().doc(path).get()
  return snap.exists ? snap.data() : null
}

const TYPES = {
  // A teacher set an assignment: tell the student.
  async 'assignment-new'(uid, id) {
    const a = await get(`assignments/${id}`)
    if (!a || a.teacherId !== uid || !a.studentId || !fresh(a.createdAt)) return null
    const teacher = await get(`users/${uid}`)
    return { to: a.studentId, kind: 'assignment-new', event: `assignment:${id}`, vars: { teacher: firstName(teacher?.displayName) ?? 'Your teacher', title: clip(a.title, 80) } }
  },
  // A teacher approved work or sent it back: tell the student.
  async 'assignment-reviewed'(uid, id) {
    const a = await get(`assignments/${id}`)
    const last = a?.feedback?.[a.feedback.length - 1]
    if (!a || a.teacherId !== uid || !a.studentId || !last || !fresh(last.at)) return null
    const teacher = await get(`users/${uid}`)
    const approved = last.verdict === 'approved'
    return {
      to: a.studentId,
      kind: approved ? 'assignment-approved' : 'assignment-returned',
      event: `review:${id}:${a.feedback.length}`,
      vars: { teacher: firstName(teacher?.displayName) ?? 'Your teacher', title: clip(a.title, 80), note: last.note ? clip(last.note, 120) : undefined },
    }
  },
  // A student handed work in: tell the teacher.
  async 'work-handed-in'(uid, id) {
    const a = await get(`assignments/${id}`)
    const last = a?.submissions?.[a.submissions.length - 1]
    if (!a || a.studentId !== uid || !a.teacherId || !last || !fresh(last.at)) return null
    const student = await get(`users/${uid}`)
    return { to: a.teacherId, kind: 'work-handed-in', event: `handin:${id}:${a.submissions.length}`, vars: { student: firstName(student?.displayName) ?? 'A student', title: clip(a.title, 80) } }
  },
  // A teacher put a piece in a student's Library: tell the student.
  async 'piece-from-teacher'(uid, id) {
    const p = await get(`pieces/${id}`)
    if (!p || p.addedBy !== 'teacher' || !fresh(p.startedAt)) return null
    const student = await get(`users/${p.userId}`)
    if (student?.teacherId !== uid) return null
    const teacher = await get(`users/${uid}`)
    return { to: p.userId, kind: 'piece-from-teacher', event: `piece:${id}`, vars: { teacher: firstName(teacher?.displayName) ?? 'Your teacher', piece: clip(p.title, 80) } }
  },
  // A message, either way.
  async message(uid, id) {
    const m = await get(`messages/${id}`)
    if (!m || !fresh(m.createdAt)) return null
    const preview = m.text ? clip(m.text, 120) : 'Shared something with you'
    if (m.from === 'teacher' && m.teacherId === uid) {
      const teacher = await get(`users/${uid}`)
      return { to: m.studentId, kind: 'message-from-teacher', event: `message:${id}`, vars: { teacher: teacher?.displayName || 'Your teacher', preview } }
    }
    if (m.from === 'student' && m.studentId === uid) {
      const student = await get(`users/${uid}`)
      return { to: m.teacherId, kind: 'message-from-student', event: `message:${id}`, vars: { student: student?.displayName || 'A student', preview } }
    }
    return null
  },
  // A student asked to join: tell the teacher.
  async 'join-request'(uid, id) {
    const r = await get(`studioRequests/${id}`)
    if (!r || r.studentId !== uid || r.status !== 'pending' || !fresh(r.createdAt)) return null
    const teacher = await get(`users/${r.teacherId}`)
    return { to: r.teacherId, kind: 'join-request', event: `join:${id}:${r.createdAt}`, vars: { student: firstName(r.studentName) ?? 'A student', studio: teacher?.studioName || 'your studio' } }
  },
  // The teacher said yes: tell the student.
  async 'joined-studio'(uid, id) {
    const r = await get(`studioRequests/${id}`)
    if (!r || r.teacherId !== uid || r.status !== 'accepted' || !fresh(r.decidedAt)) return null
    const teacher = await get(`users/${uid}`)
    return { to: r.studentId, kind: 'joined-studio', event: `joined:${id}:${r.decidedAt}`, vars: { teacher: firstName(teacher?.displayName) ?? 'Your teacher', studio: teacher?.studioName || 'the studio' } }
  },
}

export default handler(async (req) => {
  const uid = await callerUid(req)
  const { type, id } = await jsonBody(req)
  const make = Object.hasOwn(TYPES, type) ? TYPES[type] : null
  if (!make || typeof id !== 'string' || !/^[\w-]{1,128}$/.test(id)) throw new HttpError(400, 'Unknown event.')
  const push = await make(uid, id)
  if (!push || push.to === uid) return { sent: false }
  return { sent: await sendToUser(push.to, push.kind, push.vars, push.event) }
})
