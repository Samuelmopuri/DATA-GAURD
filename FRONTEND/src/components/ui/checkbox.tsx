import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, checked, onChange, onCheckedChange, id, disabled, ...props }, ref) => {
    const generatedId = React.useId();
    const checkboxId = id || generatedId;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onCheckedChange?.(e.target.checked);
    };

    return (
      <label
        htmlFor={checkboxId}
        className={cn(
          'inline-flex items-start gap-2.5 cursor-pointer select-none',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            type="checkbox"
            id={checkboxId}
            ref={ref}
            checked={checked}
            disabled={disabled}
            onChange={handleChange}
            className="peer sr-only"
            {...props}
          />
          <div
            className={cn(
              'h-4 w-4 rounded border border-slate-600 bg-slate-900 transition-all duration-150',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-950',
              'peer-checked:border-cyan-500 peer-checked:bg-cyan-500',
              className
            )}
          >
            <Check
              className={cn(
                'h-3.5 w-3.5 text-slate-950 transition-transform duration-150',
                checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
              )}
              strokeWidth={3}
            />
          </div>
        </div>
        {(label || description) && (
          <div className="grid gap-0.5 leading-none">
            {label && <span className="text-sm font-medium text-slate-200">{label}</span>}
            {description && <span className="text-xs text-slate-400">{description}</span>}
          </div>
        )}
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';
