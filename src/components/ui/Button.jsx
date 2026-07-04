import { cn } from '@/lib/utils'

const variants = {
  primary: 'bg-brand-yellow text-black hover:bg-brand-yellow-dark',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
  danger: 'bg-red-500 text-white hover:bg-red-600',
  ghost: 'text-gray-700 hover:bg-gray-100',
  outline: 'border border-gray-200 text-gray-700 hover:bg-gray-50',
}

const sizes = {
  sm: 'px-3 py-2 text-sm rounded-lg',
  md: 'px-4 py-3 text-sm rounded-xl',
  lg: 'px-5 py-3.5 text-base rounded-xl',
  icon: 'p-2.5 rounded-xl',
}

export function Button({ variant = 'primary', size = 'md', className, children, disabled, loading, ...props }) {
  return (
    <button
      className={cn(
        'font-semibold transition-all active:scale-95 touch-manipulation flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}
