import { cn } from '@/lib/utils'

export function Input({ label, error, className, ...props }) {
  return (
    <div className="space-y-1">
      {label && <label className="label">{label}</label>}
      <input
        className={cn('input-field', error && 'border-red-300 focus:ring-red-400', className)}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function Select({ label, error, children, className, ...props }) {
  return (
    <div className="space-y-1">
      {label && <label className="label">{label}</label>}
      <select
        className={cn('input-field', error && 'border-red-300', className)}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function Textarea({ label, error, className, ...props }) {
  return (
    <div className="space-y-1">
      {label && <label className="label">{label}</label>}
      <textarea
        rows={3}
        className={cn('input-field resize-none', error && 'border-red-300', className)}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
