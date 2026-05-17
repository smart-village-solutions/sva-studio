import * as React from 'react';

import { cn } from '@/lib/utils';

type SwitchProps = Readonly<{
  checked: boolean;
  disabled?: boolean;
  'aria-label'?: string;
  onCheckedChange: (checked: boolean) => void;
}> &
  Omit<React.ComponentProps<'button'>, 'aria-label' | 'checked' | 'onChange' | 'type'>;

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, className, disabled = false, onCheckedChange, ...props }, ref) => (
    <button
      {...props}
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        checked ? 'bg-primary' : 'bg-muted',
        className
      )}
      onClick={() => onCheckedChange(!checked)}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-sm transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  )
);

Switch.displayName = 'Switch';

export { Switch };
