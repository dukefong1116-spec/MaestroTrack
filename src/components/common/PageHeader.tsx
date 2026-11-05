import { type ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 lg:mb-8">
      <div>
        <h1
          className="text-[22px] font-bold leading-tight lg:text-[26px]"
          style={{ color: 'var(--clay-ink)', fontFamily: 'var(--clay-font)' }}
        >
          {title}
        </h1>
        {subtitle && <p className="text-sm mt-1" style={{ color: 'var(--clay-dim)' }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
