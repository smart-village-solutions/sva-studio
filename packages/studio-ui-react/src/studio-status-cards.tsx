import * as React from 'react';

import { Badge, type BadgeProps } from './badge.js';
import { cn } from './utils.js';

export type StudioTechnicalStatusTone = 'neutral' | 'success' | 'warning' | 'error';

const technicalStatusBadgeVariantByTone: Record<StudioTechnicalStatusTone, BadgeProps['variant']> =
  {
    neutral: 'outline',
    success: 'default',
    warning: 'secondary',
    error: 'destructive',
  };

export type StudioTechnicalStatusMetaItem = Readonly<{
  id: string;
  label: React.ReactNode;
  value: React.ReactNode;
}>;

type StudioStatusCardBodyProps = Readonly<{
  title?: React.ReactNode;
  description?: React.ReactNode;
  statusLabel: React.ReactNode;
  statusTone: StudioTechnicalStatusTone;
  metadata?: readonly StudioTechnicalStatusMetaItem[];
  actions?: React.ReactNode;
  emptyState?: React.ReactNode;
}>;

const StudioStatusCardBody = ({
  title,
  description,
  statusLabel,
  statusTone,
  metadata,
  actions,
  emptyState,
}: StudioStatusCardBodyProps) => (
  <>
    <div className="flex flex-wrap items-start justify-between gap-3">
      {title || description ? (
        <div className="space-y-1">
          {title ? <h3 className="text-sm font-semibold">{title}</h3> : null}
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      <Badge variant={technicalStatusBadgeVariantByTone[statusTone]}>{statusLabel}</Badge>
    </div>
    {metadata?.length ? (
      <div className="flex flex-wrap gap-2">
        {metadata.map((item) => (
          <Badge key={item.id} variant="outline">
            {item.label}: {item.value}
          </Badge>
        ))}
      </div>
    ) : null}
    {!metadata?.length && emptyState ? (
      <div className="text-sm text-muted-foreground">{emptyState}</div>
    ) : null}
    {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
  </>
);

export type StudioTechnicalStatusPanelProps = Readonly<{
  title: React.ReactNode;
  description?: React.ReactNode;
  statusLabel: React.ReactNode;
  statusTone?: StudioTechnicalStatusTone;
  metadata?: readonly StudioTechnicalStatusMetaItem[];
  actions?: React.ReactNode;
  className?: string;
}>;

export function StudioTechnicalStatusPanel({
  title,
  description,
  statusLabel,
  statusTone = 'neutral',
  metadata,
  actions,
  className,
}: StudioTechnicalStatusPanelProps) {
  return (
    <section className={cn('space-y-4 rounded-lg border border-border/70 bg-card p-4', className)}>
      <StudioStatusCardBody
        title={title}
        description={description}
        statusLabel={statusLabel}
        statusTone={statusTone}
        metadata={metadata}
        actions={actions}
      />
    </section>
  );
}

export type StudioJobSummaryCardProps = Readonly<{
  announcement?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  statusLabel: React.ReactNode;
  statusTone?: StudioTechnicalStatusTone;
  metadata?: readonly StudioTechnicalStatusMetaItem[];
  actions?: React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
}>;

export function StudioJobSummaryCard({
  announcement,
  title,
  description,
  statusLabel,
  statusTone = 'neutral',
  metadata,
  actions,
  emptyState,
  className,
}: StudioJobSummaryCardProps) {
  return (
    <section className={cn('space-y-4 rounded-lg border border-border/70 bg-card p-4', className)}>
      {announcement ? (
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
      ) : null}
      <StudioStatusCardBody
        title={title}
        description={description}
        statusLabel={statusLabel}
        statusTone={statusTone}
        metadata={metadata}
        actions={actions}
        emptyState={emptyState}
      />
    </section>
  );
}
