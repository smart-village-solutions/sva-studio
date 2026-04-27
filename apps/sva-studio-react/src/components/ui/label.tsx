import * as React from 'react';

import { cn } from '@/lib/utils';

const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<'label'>>(({ className, ...props }, ref) => (
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  <label
    ref={ref}
    className={cn('animate-label-float text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
    {...props}
  />
));
Label.displayName = 'Label';

export { Label };
