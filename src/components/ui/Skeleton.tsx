import { cn } from '@/lib/utils/cn'

interface SkeletonProps {
  className?: string
}

export default function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse bg-slate-800/80 rounded-xl', className)} />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-slate-900/80 border border-slate-800/60 rounded-2xl p-5 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="bg-slate-900/80 border border-slate-800/60 rounded-2xl p-5 space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}
