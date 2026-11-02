import * as React from 'react';

import { cn } from './utils.js';

const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'animate-input-glow flex h-11 min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-action-disabled disabled:text-action-disabled-foreground disabled:opacity-100',
        className
      )}
      {...props}
    />
  )
);
Select.displayName = 'Select';

export { Select };
