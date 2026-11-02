import { useCallback, useEffect, useState } from 'react'
import { Link2, Trash2 } from 'lucide-react'
import { Panel, Block, Legend, SettingsScreen } from '@/components/ui/Panel'
import Button from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { deleteShare, listMyShares, shareUrl, type ShareRecord } from '@/lib/share/link'

/**
 * Every link you have published, and a way to take one down.
 *
 * A share used to be a picture handed to one app. A link is a public URL
 * that keeps working until someone removes it, so there has to be a
 * someone and a somewhere — this is both.
 */
export default function SharedLinksPage() {
  const { user, profile } = useAuth()
  const back = profile?.role === 'teacher' ? '/teacher/settings/privacy' : '/student/settings/privacy'

  const [rows, setRows] = useState<ShareRecord[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.uid) return
    try {
      setRows(await listMyShares(user.uid))
    } catch {
      setError('Could not load your links.')
      setRows([])
    }
  }, [user?.uid])

  useEffect(() => { void load() }, [load])

  async function remove(slug: string) {
    if (!user?.uid) return
    setBusy(slug)
    try {
      await deleteShare(user.uid, slug)
      setRows((r) => (r ?? []).filter((x) => x.slug !== slug))
    } catch {
      setError('Could not remove that link.')
    } finally {
      setBusy(null)
    }
  }

  async function copy(slug: string) {
    try {
      await navigator.clipboard.writeText(shareUrl(slug))
      setCopied(slug)
      setTimeout(() => setCopied(null), 1800)
    } catch { /* clipboard refused; the URL is on screen anyway */ }
  }

  function describe(row: ShareRecord): string {
    const f = row.fields
    if (f.badgeLabel) return f.badgeLabel
    const bits = [`${f.minutes} min`]
    if (f.pieceTitle) bits.push(f.pieceTitle)
    if (f.streakDays) bits.push(`${f.streakDays}-day streak`)
    return bits.join(' · ')
  }

  return (
    <SettingsScreen title="Shared links" back={back}>
      <Panel>
        <Block first>
          <Legend
            title="Links you have published"
            hint="Anyone who has one of these can open it, whether or not they use MaestroTrack. Removing a link makes its page disappear straight away — but a preview a chat app has already drawn may keep showing for a few days, because that copy is theirs, not ours."
          />
        </Block>

        {rows === null ? (
          <Block>
            <p className="text-sm" style={{ color: 'var(--clay-dim)' }}>Loading…</p>
          </Block>
        ) : rows.length === 0 ? (
          <Block>
            <div className="py-4 text-center">
              <Link2 size={28} className="mx-auto mb-3" style={{ color: 'var(--clay-faint)' }} />
              <p className="text-sm" style={{ color: 'var(--clay-dim)' }}>
                You haven't shared any links yet.
              </p>
            </div>
          </Block>
        ) : (
          rows.map((row) => (
            <div
              key={row.slug}
              className="flex items-center gap-3 px-5 py-3.5 sm:px-6"
              style={{ borderTop: '1px solid var(--clay-line)' }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
                  {describe(row)}
                </p>
                <p className="truncate text-xs" style={{ color: 'var(--clay-dim)' }}>
                  {row.fields.name ? `${row.fields.name} · ` : 'Anonymous · '}
                  {new Date(row.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copy(row.slug)}
                className="shrink-0 text-xs font-semibold"
                style={{ color: copied === row.slug ? 'var(--clay-success-fg)' : 'var(--clay-accent-ink)' }}
              >
                {copied === row.slug ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => void remove(row.slug)}
                disabled={busy === row.slug}
                aria-label={`Remove the link for ${describe(row)}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
                style={{ color: 'var(--clay-danger)' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}

        {error && (
          <Block>
            <p role="alert" className="text-[13px]" style={{ color: 'var(--clay-danger)' }}>{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setError(null); void load() }}>
              Try again
            </Button>
          </Block>
        )}
      </Panel>
    </SettingsScreen>
  )
}
