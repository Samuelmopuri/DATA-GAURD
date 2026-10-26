import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'warning' | 'success' | 'outline';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  const variants = {
    default:
      'border-transparent bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
    secondary:
      'border-transparent bg-slate-800 text-slate-300 border border-slate-700/60',
    destructive:
      'border-transparent bg-rose-500/15 text-rose-400 border border-rose-500/30',
    warning:
      'border-transparent bg-amber-500/15 text-amber-400 border border-amber-500/30',
    success:
      'border-transparent bg-teal-500/15 text-teal-400 border border-teal-500/30',
    outline:
      'text-slate-300 border border-slate-700',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors tracking-wide',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
Badge.displayName = 'Badge';
