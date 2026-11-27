import * as React from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';

import { Button } from './button.js';
import { cn } from './utils.js';

export type StudioStateBlockProps = Readonly<{
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  role?: React.AriaRole;
  className?: string;
}>;

export function StudioStateBlock({
  title,
  description,
  children,
  role = 'status',
  className,
}: StudioStateBlockProps) {
  const ariaLive = role === 'alert' ? 'assertive' : role === 'status' ? 'polite' : undefined;

  return (
    <div
      role={role}
      aria-live={ariaLive}
      className={cn('rounded-lg border border-border bg-card p-6', className)}
    >
      {title ? <h2 className="text-lg font-medium text-foreground">{title}</h2> : null}
      {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export type StudioBasicStateProps = Readonly<{
  children: React.ReactNode;
  className?: string;
}>;

export function StudioLoadingState({ children, className }: StudioBasicStateProps) {
  return (
    <p role="status" className={cn('text-sm text-muted-foreground', className)}>
      {children}
    </p>
  );
}

export function StudioEmptyState({ children, className }: StudioBasicStateProps) {
  return <StudioStateBlock className={className}>{children}</StudioStateBlock>;
}

export function StudioErrorState({
  children,
  className,
  onRetry,
}: StudioBasicStateProps & Readonly<{ onRetry?: () => void }>) {
  const t = usePluginTranslation('shared');
  const status = (
    <p role="status" aria-live="polite" className={cn('text-sm text-destructive', className)}>
      {children}
    </p>
  );
  return onRetry ? (
    <div className="flex flex-wrap items-center gap-2">
      {status}
      <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
        {t('errorFallback.retry')}
      </Button>
    </div>
  ) : (
    status
  );
}
