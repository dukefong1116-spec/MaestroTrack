import {
  collection, doc, query, where, setDoc, updateDoc, deleteDoc, addDoc, writeBatch, arrayUnion,
  deleteField, type Unsubscribe, type FirestoreError,
} from 'firebase/firestore'
import { db, loadStorage } from './config'
import { onServerSnapshot, onSnapshotError } from './snapshotError'
import { cleanForFirestore } from './clean'
import type {
  AssignmentAttachment, Family, Invoice, LessonNote, LessonOccurrence, LessonSlot, Payment,
  PracticeCorrection, RosterStudent, StudioLesson, StudioSettings, TeacherPracticeEntry,
} from '@/types'

/**
 * The teacher's studio records: who they teach, families, the calendar,
 * notes, invoices — and the two things a student answers (corrections) or
 * is shown (practice their teacher added, shared notes, their lessons).
 *
 * Every list subscription reports an empty list when it is refused, so a
 * page still works (empty) before the rules for these collections have
 * been published, instead of waiting for ever.
 */

const now = () => new Date().toISOString()

function listOf<T>(label: string, q: ReturnType<typeof query>, callback: (rows: T[]) => void): Unsubscribe {
  return onServerSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T)),
    (e: FirestoreError) => { onSnapshotError(label)(e); callback([]) })
}

const byTeacher = (col: string, teacherId: string) => query(collection(db, col), where('teacherId', '==', teacherId))

/* ── Roster ─────────────────────────────────────────────────────────── */

export const ROSTER = 'studioStudents'

/** The roster id for a student on the app: one per teacher and student. */
export const rosterIdFor = (teacherId: string, uid: string) => `${teacherId}_${uid}`

export function subscribeRoster(teacherId: string, cb: (r: RosterStudent[]) => void): Unsubscribe {
  return listOf('roster', byTeacher(ROSTER, teacherId), cb)
}

export async function createRosterStudent(
  teacherId: string,
  data: Omit<RosterStudent, 'id' | 'teacherId' | 'createdAt' | 'updatedAt' | 'status'> & { status?: RosterStudent['status'] },
  id?: string,
): Promise<string> {
  const ref = id ? doc(db, ROSTER, id) : doc(collection(db, ROSTER))
  await setDoc(ref, cleanForFirestore({ status: 'active', ...data, uid: data.uid ?? null, teacherId, createdAt: now(), updatedAt: now() }))
  return ref.id
}

/** null clears a field back to the studio default. */
export async function updateRosterStudent(id: string, patch: Partial<RosterStudent>): Promise<void> {
  const out: Record<string, unknown> = { updatedAt: now() }
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'id' || k === 'teacherId' || k === 'createdAt') continue
    out[k] = v === undefined ? deleteField() : Array.isArray(v) ? JSON.parse(JSON.stringify(v)) : v
  }
  await updateDoc(doc(db, ROSTER, id), out)
}

/* ── Families ───────────────────────────────────────────────────────── */

export function subscribeFamilies(teacherId: string, cb: (f: Family[]) => void): Unsubscribe {
  return listOf('families', byTeacher('families', teacherId), cb)
}

export async function saveFamily(teacherId: string, f: Partial<Family> & { name: string }): Promise<string> {
  const ref = f.id ? doc(db, 'families', f.id) : doc(collection(db, 'families'))
  await setDoc(ref, cleanForFirestore({
    teacherId, name: f.name, contacts: (f.contacts ?? []).map((c) => cleanForFirestore(c)), createdAt: f.createdAt ?? now(), updatedAt: now(),
  }))
  return ref.id
}

export async function deleteFamily(id: string): Promise<void> {
  await deleteDoc(doc(db, 'families', id))
}

/* ── Settings ───────────────────────────────────────────────────────── */

export function subscribeStudioSettings(teacherId: string, cb: (s: Partial<StudioSettings> | null) => void): Unsubscribe {
  return onServerSnapshot(doc(db, 'studioSettings', teacherId),
    (snap) => cb(snap.exists() ? (snap.data() as Partial<StudioSettings>) : null),
    (e) => { onSnapshotError('studioSettings')(e); cb(null) })
}

export async function saveStudioSettings(teacherId: string, patch: Partial<StudioSettings>): Promise<void> {
  // Through JSON: drops any undefined inside the lists (Firestore refuses them).
  await setDoc(doc(db, 'studioSettings', teacherId), { ...JSON.parse(JSON.stringify(patch)), teacherId, updatedAt: now() }, { merge: true })
}

/* ── Calendar ───────────────────────────────────────────────────────── */

export function subscribeStudioLessons(teacherId: string, cb: (l: StudioLesson[]) => void): Unsubscribe {
  return listOf('studioLessons', byTeacher('studioLessons', teacherId), cb)
}

export async function createStudioLesson(teacherId: string, data: Omit<StudioLesson, 'id' | 'teacherId' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'studioLessons'), cleanForFirestore({ ...data, teacherId, createdAt: now(), updatedAt: now() }))
  return ref.id
}

export async function updateStudioLesson(id: string, patch: Partial<StudioLesson>): Promise<void> {
  const out: Record<string, unknown> = { updatedAt: now() }
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'id' || k === 'teacherId') continue
    out[k] = v === undefined ? deleteField() : v
  }
  await updateDoc(doc(db, 'studioLessons', id), out)
}

export async function deleteStudioLesson(id: string): Promise<void> {
  await deleteDoc(doc(db, 'studioLessons', id))
}

/**
 * A slot from the old Schedule page, moved into the studio calendar the
 * first time it is edited — so the student, who reads both, never sees it
 * twice. One batch: the new weekly lesson and the old slot's removal.
 */
export async function convertLegacySlot(slot: LessonSlot, rosterId: string | undefined, where?: string, followsStudent = false): Promise<string> {
  const ref = doc(collection(db, 'studioLessons'))
  const batch = writeBatch(db)
  batch.set(ref, cleanForFirestore({
    teacherId: slot.teacherId,
    rosterIds: rosterId ? [rosterId] : [],
    studentUids: [slot.studentId],
    title: slot.studentName,
    tagId: 'private',
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    durationMinutes: slot.durationMinutes,
    fixedMinutes: followsStudent ? null : slot.durationMinutes,
    where,
    startsOn: '2000-01-01',
    createdAt: now(),
    updatedAt: now(),
  }))
  batch.delete(doc(db, 'lessonSlots', slot.id))
  await batch.commit()
  return ref.id
}

export function subscribeOccurrences(teacherId: string, cb: (o: LessonOccurrence[]) => void): Unsubscribe {
  return listOf('lessonOccurrences', byTeacher('lessonOccurrences', teacherId), cb)
}

/** Whole document, by id — a weekly lesson's date, or a one-off. */
export async function saveOccurrence(id: string | null, data: Omit<LessonOccurrence, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: string }): Promise<string> {
  const ref = id ? doc(db, 'lessonOccurrences', id) : doc(collection(db, 'lessonOccurrences'))
  await setDoc(ref, cleanForFirestore({ ...data, createdAt: data.createdAt ?? now(), updatedAt: now() }))
  return ref.id
}

export async function deleteOccurrence(id: string): Promise<void> {
  await deleteDoc(doc(db, 'lessonOccurrences', id))
}

/* ── Notes ──────────────────────────────────────────────────────────── */

export function subscribeLessonNotes(teacherId: string, cb: (n: LessonNote[]) => void): Unsubscribe {
  return listOf('lessonNotes', byTeacher('lessonNotes', teacherId), cb)
}

export async function saveLessonNote(note: Omit<LessonNote, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string }): Promise<void> {
  const { id, ...rest } = note
  const ref = id ? doc(db, 'lessonNotes', id) : doc(collection(db, 'lessonNotes'))
  if (!rest.text.trim()) { if (id) await deleteDoc(ref); return }
  await setDoc(ref, { ...cleanForFirestore({ ...rest, createdAt: rest.createdAt ?? now(), updatedAt: now() }), studentUid: rest.studentUid })
}

/* ── Invoices ───────────────────────────────────────────────────────── */

export function subscribeInvoices(teacherId: string, cb: (i: Invoice[]) => void): Unsubscribe {
  return listOf('invoices', byTeacher('invoices', teacherId), cb)
}

export async function createInvoice(data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'invoices'), { ...cleanForFirestore({ ...data, createdAt: now(), updatedAt: now() }), payments: data.payments, lines: data.lines })
  return ref.id
}

export async function updateInvoice(id: string, patch: Partial<Invoice>): Promise<void> {
  await updateDoc(doc(db, 'invoices', id), { ...patch, updatedAt: now() })
}

export async function recordPayment(id: string, p: Payment): Promise<void> {
  await updateDoc(doc(db, 'invoices', id), { payments: arrayUnion(cleanForFirestore(p)), updatedAt: now() })
}

export async function markInvoicesReminded(ids: string[]): Promise<void> {
  const at = now()
  const batch = writeBatch(db)
  ids.forEach((id) => batch.update(doc(db, 'invoices', id), { remindedAt: arrayUnion(at), updatedAt: at }))
  await batch.commit()
}

/* ── Practice: corrections and teacher-added practice ───────────────── */

export function subscribeTeacherCorrections(teacherId: string, cb: (c: PracticeCorrection[]) => void): Unsubscribe {
  return listOf('practiceCorrections', byTeacher('practiceCorrections', teacherId), cb)
}

export async function suggestCorrection(c: Omit<PracticeCorrection, 'id' | 'createdAt' | 'status'>): Promise<void> {
  await addDoc(collection(db, 'practiceCorrections'), cleanForFirestore({ ...c, status: 'pending', createdAt: now() }))
}

export async function withdrawCorrection(id: string): Promise<void> {
  await deleteDoc(doc(db, 'practiceCorrections', id))
}

export function subscribeMyCorrections(uid: string, cb: (c: PracticeCorrection[]) => void): Unsubscribe {
  return listOf('myCorrections', query(collection(db, 'practiceCorrections'), where('studentId', '==', uid)), cb)
}

export async function decideCorrection(id: string, accepted: boolean): Promise<void> {
  await updateDoc(doc(db, 'practiceCorrections', id), { status: accepted ? 'accepted' : 'declined', decidedAt: now() })
}

export function subscribeTeacherPractice(teacherId: string, cb: (e: TeacherPracticeEntry[]) => void): Unsubscribe {
  return listOf('teacherPractice', byTeacher('teacherPractice', teacherId), cb)
}

export async function addTeacherPractice(e: Omit<TeacherPracticeEntry, 'id' | 'createdAt'>): Promise<void> {
  await addDoc(collection(db, 'teacherPractice'), { ...cleanForFirestore({ ...e, createdAt: now() }), studentUid: e.studentUid })
}

export async function deleteTeacherPractice(id: string): Promise<void> {
  await deleteDoc(doc(db, 'teacherPractice', id))
}

/* ── What a student reads ───────────────────────────────────────────── */

export function subscribeMyStudioLessons(uid: string, cb: (l: StudioLesson[]) => void): Unsubscribe {
  return listOf('myLessons', query(collection(db, 'studioLessons'), where('studentUids', 'array-contains', uid)), cb)
}

export function subscribeMyOccurrences(uid: string, cb: (o: LessonOccurrence[]) => void): Unsubscribe {
  return listOf('myOccurrences', query(collection(db, 'lessonOccurrences'), where('studentUids', 'array-contains', uid)), cb)
}

export function subscribeMySharedNotes(uid: string, cb: (n: LessonNote[]) => void): Unsubscribe {
  return listOf('mySharedNotes', query(collection(db, 'lessonNotes'), where('studentUid', '==', uid), where('visibility', '==', 'shared')), cb)
}

export function subscribeMyTeacherPractice(uid: string, cb: (e: TeacherPracticeEntry[]) => void): Unsubscribe {
  return listOf('myTeacherPractice', query(collection(db, 'teacherPractice'), where('studentUid', '==', uid)), cb)
}

/* ── Attachments ────────────────────────────────────────────────────── */

const KINDS: [RegExp, AssignmentAttachment['kind']][] = [
  [/^audio\//, 'audio'], [/^video\//, 'video'], [/^application\/pdf$/, 'pdf'], [/^image\/(jpeg|png|webp)$/, 'image'],
]

export function attachmentKind(type: string): AssignmentAttachment['kind'] | null {
  return KINDS.find(([re]) => re.test(type))?.[1] ?? null
}

/** Files a teacher attaches to work: under their own folder, read by their students. */
export async function uploadAttachment(teacherId: string, file: File): Promise<AssignmentAttachment> {
  const kind = attachmentKind(file.type)
  if (!kind) throw new Error('Audio, video, a PDF or a photo (JPEG, PNG, WebP) only.')
  if (file.size > 100 * 1024 * 1024) throw new Error('That file is over 100 MB.')
  const { storage, ref, uploadBytes } = await loadStorage()
  const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-80)
  const path = `studio/${teacherId}/attachments/${Date.now().toString(36)}_${safe}`
  await uploadBytes(ref(storage, path), file, { contentType: file.type })
  return { kind, name: file.name.slice(0, 120), storagePath: path }
}

export async function attachmentUrl(a: Pick<AssignmentAttachment, 'storagePath'>): Promise<string> {
  const { storage, ref, getDownloadURL } = await loadStorage()
  return getDownloadURL(ref(storage, a.storagePath))
}
