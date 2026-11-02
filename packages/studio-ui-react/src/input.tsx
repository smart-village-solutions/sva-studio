import * as React from 'react';

import { cn } from './utils.js';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'animate-input-glow flex h-11 min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-action-disabled disabled:text-action-disabled-foreground disabled:opacity-100',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
