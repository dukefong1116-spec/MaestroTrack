import { type ReactNode } from 'react'
import Button from '@/components/ui/Button'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="mb-4 flex justify-center" style={{ color: 'var(--clay-accent)', opacity: 0.55 }}>{icon}</div>
      )}
      <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--clay-ink)', fontFamily: 'var(--clay-font)' }}>{title}</h3>
      <p className="text-sm max-w-sm mb-6" style={{ color: 'var(--clay-dim)' }}>{description}</p>
      {action && (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  )
}
