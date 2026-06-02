import * as React from 'react';

import { cn } from '@/lib/utils';

import { Card } from './ui/card';

type StudioSummaryCardProps = React.HTMLAttributes<HTMLDivElement> & {
  readonly eyebrow: string;
  readonly value: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly valueClassName?: string;
};

export const StudioSummaryCard = React.forwardRef<HTMLDivElement, StudioSummaryCardProps>(
  ({ className, eyebrow, value, description, valueClassName, children, ...props }, ref) => (
    <Card
      ref={ref}
      className={cn('border-border/70 bg-background/90 p-4 shadow-shell', className)}
      {...props}
    >
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p>
        <div className="space-y-1">
          <div className={cn('text-3xl font-semibold text-foreground', valueClassName)}>
            {value}
          </div>
          {description ? (
            <div className="text-sm text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {children ? <div className="pt-1">{children}</div> : null}
      </div>
    </Card>
  )
);
StudioSummaryCard.displayName = 'StudioSummaryCard';
