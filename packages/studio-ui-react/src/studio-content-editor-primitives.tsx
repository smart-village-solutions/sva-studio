import type React from 'react';

import { Button } from './button.js';
import { cn } from './utils.js';

export type StudioDetailCardProps = Readonly<{
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}>;

export function StudioDetailCard({
  title,
  description,
  actions,
  children,
  className,
}: StudioDetailCardProps) {
  return (
    <section className={cn('space-y-4 rounded-2xl border border-border/60 bg-card p-5', className)}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold text-card-foreground">{title}</h3>
          {description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export type StudioPaginationProps = Readonly<{
  page: number;
  hasNextPage: boolean;
  ariaLabel: string;
  pageLabel: React.ReactNode;
  previousLabel: React.ReactNode;
  nextLabel: React.ReactNode;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
}>;

export function StudioPagination({
  page,
  hasNextPage,
  ariaLabel,
  pageLabel,
  previousLabel,
  nextLabel,
  onPageChange,
  disabled = false,
  className,
}: StudioPaginationProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground',
        className
      )}
    >
      <p key={page} aria-live="polite" className="animate-pagination-active tabular-nums">
        {pageLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          {previousLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || !hasNextPage}
          onClick={() => onPageChange(page + 1)}
        >
          {nextLabel}
        </Button>
      </div>
    </nav>
  );
}
