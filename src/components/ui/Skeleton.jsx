import { cn } from '@/lib/utils'

export function Skeleton({ className }) {
  return <div className={cn('shimmer rounded-lg', className)} />
}

export function OrderCardSkeleton() {
  return (
    <div className="card space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-32" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
      </div>
    </div>
  )
}
