import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Mic, Upload, Play, Pause, Trash2, Calendar } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { uploadRecording, deleteRecording } from '@/lib/firebase/recordings'
import PageHeader from '@/components/common/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/common/EmptyState'
import type { Recording } from '@/types'

export default function RecordingsPage() {
  const { profile, user } = useAuth()
  const { recordings } = usePracticeStore()
  const [open, setOpen] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ pieceName: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' })
  const [file, setFile] = useState<File | null>(null)
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})

  async function handleUpload() {
    if (!profile || !file) return
    setUploading(true)
    try {
      await uploadRecording(profile.uid, file, { pieceName: form.pieceName, date: form.date, notes: form.notes }, setUploadProgress)
      setOpen(false)
      setFile(null)
      setForm({ pieceName: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' })
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  function togglePlay(rec: Recording) {
    const audio = audioRefs.current[rec.id]
    if (!audio) {
      const a = new Audio(rec.audioUrl)
      audioRefs.current[rec.id] = a
      a.play()
      setPlayingId(rec.id)
      a.onended = () => setPlayingId(null)
    } else if (audio.paused) {
      audio.play()
      setPlayingId(rec.id)
    } else {
      audio.pause()
      setPlayingId(null)
    }
  }

  async function handleDelete(rec: Recording) {
    if (audioRefs.current[rec.id]) {
      audioRefs.current[rec.id].pause()
      delete audioRefs.current[rec.id]
    }
    await deleteRecording(rec.id, rec.audioUrl)
    if (playingId === rec.id) setPlayingId(null)
  }

  const grouped = recordings.reduce<Record<string, Recording[]>>((acc, r) => {
    const key = r.date.substring(0, 7)
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  return (
    <div>
      <PageHeader
        title="Recording Journal"
        subtitle="Track your musical progression over time."
        actions={<Button onClick={() => setOpen(true)}><Upload size={16} /> Upload Recording</Button>}
      />

      {recordings.length === 0 ? (
        <EmptyState
          icon={<Mic size={36} />}
          title="No recordings yet"
          description="Upload audio recordings to track how your playing evolves over time."
          action={{ label: 'Upload First Recording', onClick: () => setOpen(true) }}
        />
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([month, recs]) => (
            <div key={month}>
              <div className="flex items-center gap-3 mb-4">
                <p className="text-sm font-semibold text-slate-300">{format(parseISO(`${month}-01`), 'MMMM yyyy')}</p>
                <div className="flex-1 h-px bg-slate-800" />
              </div>
              <div className="space-y-3">
                {recs.map((rec, i) => (
                  <motion.div key={rec.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className="p-4">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => togglePlay(rec)}
                          className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center shrink-0 transition-colors"
                        >
                          {playingId === rec.id ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white ml-0.5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{rec.pieceName}</p>
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Calendar size={10} /> {format(parseISO(rec.date), 'MMMM d, yyyy')}
                          </p>
                          {rec.notes && <p className="text-xs text-slate-400 mt-1 italic">"{rec.notes}"</p>}
                        </div>
                        <button onClick={() => handleDelete(rec)} className="text-slate-600 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Upload Recording">
        <div className="space-y-4">
          <Input label="Piece Name" placeholder="Bach Prelude in C" value={form.pieceName} onChange={(e) => setForm((f) => ({ ...f, pieceName: e.target.value }))} />
          <Input label="Date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          <Textarea label="Notes (optional)" placeholder="Context about this recording..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <div>
            <label className="text-sm font-medium text-slate-300 block mb-2">Audio File</label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer"
            />
          </div>
          {uploading && (
            <div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-xs text-slate-400 mt-1">{Math.round(uploadProgress)}% uploaded</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleUpload} loading={uploading} disabled={!file || !form.pieceName} className="flex-1">Upload</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
