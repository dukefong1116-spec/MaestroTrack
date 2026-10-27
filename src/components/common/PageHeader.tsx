import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start justify-between gap-4 mb-6 pr-14 lg:mb-8 lg:pr-0"
    >
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
    </motion.div>
  )
}
