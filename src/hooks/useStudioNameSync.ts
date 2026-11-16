import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { refreshStudioName } from '@/lib/firebase/teacher'

/**
 * Keeps each student's copy of the studio name and the teacher's name in
 * step with the teacher's own profile. Runs in the teacher's app only,
 * and writes only to a student whose copy is out of date, so a settled
 * studio costs nothing.
 */
export function useStudioNameSync() {
  const { profile } = useAuth()
  const students = useTeacherStore((s) => s.students)
  const isTeacher = profile?.role === 'teacher'
  const studioName = profile?.studioName ?? ''
  const teacherName = profile?.displayName ?? ''

  useEffect(() => {
    if (!isTeacher || !profile?.uid || (!studioName && !teacherName)) return
    for (const s of students) {
      if (s.teacherId !== profile.uid) continue
      if ((s.studioName ?? '') === studioName && (s.teacherName ?? '') === teacherName) continue
      refreshStudioName(s.uid, studioName, teacherName).catch((e) => console.warn('[studio] could not update a student’s studio name', e))
    }
  }, [isTeacher, profile?.uid, studioName, teacherName, students])
}
