import * as React from 'react';

import { cn } from '@/lib/utils';

import { Card } from './ui/card';

export const StudioFilterSurface = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <Card
    ref={ref}
    className={cn('border-border/70 bg-card/85 p-4 shadow-shell', className)}
    {...props}
  />
));
StudioFilterSurface.displayName = 'StudioFilterSurface';
