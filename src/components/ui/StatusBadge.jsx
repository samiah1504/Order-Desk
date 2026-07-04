import { STATUS_LABELS, STATUS_COLORS, cn } from '@/lib/utils'

export function StatusBadge({ status, className }) {
  const label = STATUS_LABELS[status] || status
  const color = STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'
  return (
    <span className={cn('status-badge', color, className)}>
      {label}
    </span>
  )
}
