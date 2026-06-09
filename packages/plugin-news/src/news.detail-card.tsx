import * as React from 'react';
import { cn } from '@sva/studio-ui-react';

export type NewsDetailCardProps = Readonly<{
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}>;

export function NewsDetailCard({
  title,
  description,
  actions,
  className,
  children,
}: NewsDetailCardProps) {
  return (
    <section className={cn('rounded-2xl border border-border/70 bg-card p-5 shadow-sm', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-card-foreground">{title}</h3>
          {description ? <p className="text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}
