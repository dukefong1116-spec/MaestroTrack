import { cn } from '@/lib/utils/cn'

interface SkeletonProps {
  className?: string
}

/** Clay loading placeholder — a soft recessed block, not a dark bar. */
export default function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-xl', className)}
      style={{ background: 'var(--clay-bg-deep)' }}
    />
  )
}

function shell(children: React.ReactNode) {
  return (
    <div
      className="rounded-[var(--clay-r-md)] p-5 space-y-3"
      style={{ background: 'var(--clay-surface)', boxShadow: 'var(--clay-raised)' }}
    >
      {children}
    </div>
  )
}

export function StatCardSkeleton() {
  return shell(
    <>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </>
  )
}

export function ChartSkeleton() {
  return shell(
    <>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-48 w-full" />
    </>
  )
}
