import { cn } from '../../lib/utils'
interface BadgeProps { children: React.ReactNode; variant?: 'default'|'success'|'warning'|'error'|'info'; className?: string }
export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium', {
      'bg-[#2A2A2C] text-muted': variant === 'default',
      'bg-green-900/30 text-green-400': variant === 'success',
      'bg-yellow-900/30 text-yellow-400': variant === 'warning',
      'bg-red-900/30 text-red-400': variant === 'error',
      'bg-blue-900/30 text-blue-400': variant === 'info',
    }, className)}>
      {children}
    </span>
  )
}
