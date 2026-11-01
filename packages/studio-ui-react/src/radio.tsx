import * as React from 'react';
import { cn } from './utils.js';

/** Native group/validation behavior with a 44 px input and a compact visual indicator. */
export const Radio = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentPropsWithoutRef<'input'>, 'type'>
>(({ className, ...props }, ref) => (
  <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center">
    <input
      {...props}
      ref={ref}
      type="radio"
      className={cn(
        'peer absolute inset-0 h-11 w-11 cursor-pointer opacity-0 disabled:cursor-not-allowed forced-colors:appearance-auto forced-colors:opacity-100',
        className
      )}
    />
    <span
      aria-hidden="true"
      className="pointer-events-none h-5 w-5 rounded-full border border-input bg-card peer-checked:border-[6px] peer-checked:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background peer-disabled:border-action-disabled-border peer-disabled:bg-action-disabled forced-colors:hidden"
    />
  </span>
));
Radio.displayName = 'Radio';
