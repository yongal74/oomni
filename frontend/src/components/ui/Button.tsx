import { cn } from '../../lib/utils'
import { Loader2 } from 'lucide-react'
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary'|'secondary'|'ghost'|'danger'
  size?: 'sm'|'md'|'lg'
  loading?: boolean
}
export function Button({ children, variant='primary', size='md', loading, disabled, className, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center gap-1.5 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        {
          'bg-primary text-white hover:bg-primary-hover': variant === 'primary',
          'bg-surface border border-border text-text hover:bg-[#222224]': variant === 'secondary',
          'text-muted hover:text-text hover:bg-[#1E1E20]': variant === 'ghost',
          'bg-red-900/30 text-red-400 hover:bg-red-900/50': variant === 'danger',
          'px-2 py-1 text-[12px]': size === 'sm',
          'px-3 py-1.5 text-[13px]': size === 'md',
          'px-4 py-2 text-[14px]': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={12} className="animate-spin" />}
      {children}
    </button>
  )
}
