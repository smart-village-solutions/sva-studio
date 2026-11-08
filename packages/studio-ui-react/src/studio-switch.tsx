import * as React from 'react';
import { cn } from './utils.js';

export type StudioSwitchProps = Omit<
  React.ComponentPropsWithoutRef<'button'>,
  'onChange' | 'onClick' | 'type' | 'role' | 'aria-checked'
> &
  Readonly<{
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }>;

/** A native button keeps Space/Enter activation and never submits its enclosing form. */
export const StudioSwitch = React.forwardRef<HTMLButtonElement, StudioSwitchProps>(
  ({ checked, onCheckedChange, className, ...props }, ref) => (
    <button
      {...props}
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn(
        'relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed',
        className
      )}
      onClick={() => onCheckedChange(!checked)}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex h-6 w-11 items-center rounded-full border transition-colors',
          props.disabled
            ? 'border-action-disabled-border bg-action-disabled'
            : checked
              ? 'border-primary bg-primary'
              : 'border-input bg-card'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-full transition-transform',
            props.disabled
              ? checked
                ? 'translate-x-5 bg-card'
                : 'translate-x-0.5 bg-card'
              : checked
                ? 'translate-x-5 bg-primary-foreground'
                : 'translate-x-0.5 bg-muted-foreground'
          )}
        />
      </span>
    </button>
  )
);
StudioSwitch.displayName = 'StudioSwitch';
