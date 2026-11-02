import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

/**
 * The "are you sure?" behind both Log Out buttons.
 *
 * Cancel is the wide one and sits first: the common answer to a question
 * nobody went looking for is no, so the easy target is the one that
 * changes nothing.
 */
export default function LogOutSheet({
  open, busy, onCancel, onConfirm,
}: {
  open: boolean
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal open={open} onClose={busy ? () => {} : onCancel} title="Log out?" size="sm">
      <p className="text-sm" style={{ color: 'var(--clay-dim)' }}>
        You'll need your email and password to get back in. Nothing you have
        logged is lost.
      </p>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>
          Stay signed in
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={busy}>
          Log out
        </Button>
      </div>
    </Modal>
  )
}
