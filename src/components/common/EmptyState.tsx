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
        <div className="text-5xl mb-4 opacity-40">{icon}</div>
      )}
      <h3 className="text-lg font-semibold mb-2" style={{ color: '#22201C' }}>{title}</h3>
      <p className="text-sm max-w-sm mb-6" style={{ color: '#6B6860' }}>{description}</p>
      {action && (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  )
}
