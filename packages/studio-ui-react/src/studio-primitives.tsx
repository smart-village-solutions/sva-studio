import * as React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog.js';
import { Badge, type BadgeProps } from './badge.js';
import { Button, type ButtonProps } from './button.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.js';
import { cn } from './utils.js';

export type StudioPageHeaderProps = Readonly<{
  title: React.ReactNode;
  titleId?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}>;

export function StudioPageHeader({ title, titleId, description, actions, className }: StudioPageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between', className)}>
      <div className="space-y-2">
        <h1 id={titleId} className="text-3xl font-semibold text-foreground">
          {title}
        </h1>
        {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-start gap-2">{actions}</div> : null}
    </header>
  );
}

export type StudioOverviewPageTemplateProps = Readonly<{
  title: React.ReactNode;
  description?: React.ReactNode;
  primaryAction?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}>;

export function StudioOverviewPageTemplate({
  title,
  description,
  primaryAction,
  toolbar,
  children,
  className,
}: StudioOverviewPageTemplateProps) {
  return (
    <section className={cn('space-y-5', className)}>
      <StudioPageHeader title={title} description={description} actions={primaryAction} />
      {toolbar ? <div className="flex flex-wrap items-center gap-3">{toolbar}</div> : null}
      {children}
    </section>
  );
}

export type StudioListPageAction = Readonly<{
  label: React.ReactNode;
  disabled?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  render?: React.ReactNode;
  variant?: ButtonProps['variant'];
}>;

export type StudioListPageTab = Readonly<{
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  content: React.ReactNode;
}>;

export type StudioListPageTemplateProps = Readonly<{
  title: React.ReactNode;
  description?: React.ReactNode;
  primaryAction?: StudioListPageAction;
  tabs?: readonly StudioListPageTab[];
  tabsAriaLabel?: string;
  children?: React.ReactNode;
  className?: string;
}>;

const wrapHeaderActions = (actions?: React.ReactNode) =>
  actions ? <div className="flex shrink-0 items-start">{actions}</div> : undefined;

const renderStudioListPageAction = (action: StudioListPageAction) => {
  if (action.render !== undefined) {
    return action.render;
  }

  return (
    <Button type="button" onClick={action.onClick} disabled={action.disabled} variant={action.variant ?? 'default'}>
      {action.icon}
      {action.label}
    </Button>
  );
};

export function StudioListPageTemplate({
  title,
  description,
  primaryAction,
  tabs,
  tabsAriaLabel,
  children,
  className,
}: StudioListPageTemplateProps) {
  const hasTabs = Boolean(tabs && tabs.length > 0);
  const defaultTab = tabs?.[0]?.id;
  const titleId = React.useId();
  const tabListLabel = tabsAriaLabel ?? (typeof title === 'string' ? title : undefined);
  const tabListLabelledBy = tabListLabel ? undefined : titleId;

  return (
    <section className={cn('space-y-5', className)}>
      <StudioPageHeader
        title={title}
        titleId={titleId}
        description={description}
        actions={wrapHeaderActions(
          primaryAction ? renderStudioListPageAction(primaryAction) : undefined
        )}
      />

      {hasTabs && tabs ? (
        <Tabs defaultValue={defaultTab} className="space-y-0">
          <TabsList aria-label={tabListLabel} aria-labelledby={tabListLabelledBy}>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="space-y-3">
              {tab.description ? <p className="text-sm text-muted-foreground">{tab.description}</p> : null}
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        children
      )}
    </section>
  );
}

export type StudioDetailPageTemplateProps = Readonly<{
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}>;

export function StudioDetailPageTemplate({
  title,
  description,
  actions,
  children,
  className,
}: StudioDetailPageTemplateProps) {
  return (
    <section className={cn('space-y-6', className)}>
      <StudioPageHeader title={title} description={description} actions={actions} />
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export type StudioFieldProps = Readonly<{
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  descriptionId?: string;
  errorId?: string;
  required?: boolean;
  controlProps?: StudioFieldControlProps;
  children: React.ReactNode;
  className?: string;
}>;

export type StudioFieldControlProps = Readonly<{
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}>;

const mergeDescribedBy = (currentValue: string | undefined, nextValue: string | undefined) => {
  const tokens = [...(currentValue?.split(/\s+/) ?? []), ...(nextValue?.split(/\s+/) ?? [])].filter(Boolean);
  return tokens.length > 0 ? Array.from(new Set(tokens)).join(' ') : undefined;
};

type StudioFieldChildProps = Readonly<{
  id?: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}>;

export function StudioField({
  id,
  label,
  description,
  error,
  descriptionId = `${id}-description`,
  errorId = `${id}-error`,
  required = false,
  controlProps,
  children,
  className,
}: StudioFieldProps) {
  const childElement = React.isValidElement<StudioFieldChildProps>(children) ? children : null;
  const resolvedControlId = controlProps?.id ?? id;
  const resolvedChildren =
    controlProps && childElement
      ? React.cloneElement(childElement, {
          ...controlProps,
          'aria-describedby': mergeDescribedBy(
            childElement.props['aria-describedby'],
            controlProps['aria-describedby']
          ),
          'aria-invalid': controlProps['aria-invalid'] ?? childElement.props['aria-invalid'],
          id: controlProps.id,
        })
      : children;

  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={resolvedControlId} className="text-sm font-medium">
        {label}
        {required ? <span aria-hidden="true" className="ml-1 before:content-['*']" /> : null}
      </label>
      {resolvedChildren}
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type StudioFieldGroupProps = Readonly<{
  children: React.ReactNode;
  columns?: 1 | 2;
  className?: string;
}>;

export function StudioFieldGroup({ children, columns = 1, className }: StudioFieldGroupProps) {
  return <div className={cn(columns === 2 ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4', className)}>{children}</div>;
}

export type StudioFormSummaryProps = Readonly<{
  kind: 'success' | 'error';
  children: React.ReactNode;
  className?: string;
}>;

export function StudioFormSummary({ kind, children, className }: StudioFormSummaryProps) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(kind === 'error' ? 'text-destructive' : 'text-primary', className)}
    >
      {children}
    </p>
  );
}

export type StudioConfirmDialogProps = Readonly<{
  open: boolean;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmLabel: React.ReactNode;
  cancelLabel: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
  confirmDisabled?: boolean;
}>;

export function StudioConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  children,
  confirmDisabled = false,
}: StudioConfirmDialogProps) {
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onCancel();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children ? <div className="mt-4">{children}</div> : null}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type StudioTechnicalStatusTone = 'neutral' | 'success' | 'warning' | 'error';

const technicalStatusBadgeVariantByTone: Record<StudioTechnicalStatusTone, BadgeProps['variant']> = {
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
  title: React.ReactNode;
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
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
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
    {!metadata?.length && emptyState ? <div className="text-sm text-muted-foreground">{emptyState}</div> : null}
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
  title: React.ReactNode;
  description?: React.ReactNode;
  statusLabel: React.ReactNode;
  statusTone?: StudioTechnicalStatusTone;
  metadata?: readonly StudioTechnicalStatusMetaItem[];
  actions?: React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
}>;

export function StudioJobSummaryCard({
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
    <div role={role} aria-live={ariaLive} className={cn('rounded-lg border border-border bg-card p-6', className)}>
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

export function StudioErrorState({ children, className }: StudioBasicStateProps) {
  return (
    <p role="status" aria-live="polite" className={cn('text-sm text-destructive', className)}>
      {children}
    </p>
  );
}
