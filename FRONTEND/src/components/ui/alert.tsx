import * as React from 'react';
import { cn } from '@/lib/utils';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'warning' | 'success';
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'border-slate-800 bg-slate-900/80 text-slate-200 [&>svg]:text-cyan-400',
      destructive:
        'border-rose-900/60 bg-rose-950/40 text-rose-200 [&>svg]:text-rose-400',
      warning:
        'border-amber-900/60 bg-amber-950/40 text-amber-200 [&>svg]:text-amber-400',
      success:
        'border-teal-900/60 bg-teal-950/40 text-teal-200 [&>svg]:text-teal-400',
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'relative w-full rounded-xl border p-4 text-sm [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Alert.displayName = 'Alert';

export const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn('mb-1 font-semibold leading-none tracking-tight', className)} {...props} />
  )
);
AlertTitle.displayName = 'AlertTitle';

export const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed text-slate-300', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';
