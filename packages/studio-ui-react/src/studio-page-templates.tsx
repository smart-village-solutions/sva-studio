import * as React from 'react';

import { Button, type ButtonProps } from './button.js';
import { StudioPageHeader } from './studio-page-header.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.js';
import { cn } from './utils.js';

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
      <StudioPageHeader
        title={title}
        description={description}
        actions={primaryAction}
        withTitleAccessory
      />
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
    <Button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      variant={action.variant ?? 'primary'}
    >
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
        withTitleAccessory
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
              {tab.description ? (
                <p className="text-sm text-muted-foreground">{tab.description}</p>
              ) : null}
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
  stickyActions?: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}>;

export type StudioFormActionBarProps = Readonly<{
  children: React.ReactNode;
  position?: 'start' | 'end';
  className?: string;
}>;

export function StudioFormActionBar({
  children,
  position = 'end',
  className,
}: StudioFormActionBarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-end gap-3 border-border/60',
        position === 'start' ? 'border-b pb-4' : 'border-t pt-4',
        className
      )}
    >
      {children}
    </div>
  );
}

export function StudioDetailPageTemplate({
  stickyActions = false,
  title,
  description,
  actions,
  primaryAction,
  children,
  className,
}: StudioDetailPageTemplateProps) {
  const headerActions =
    actions || primaryAction ? (
      <>
        {actions}
        {primaryAction}
      </>
    ) : undefined;

  return (
    <section
      onInvalidCapture={(event) => {
        if (!stickyActions) return;
        let details = (event.target as HTMLElement).closest('details');
        while (details) {
          details.open = true;
          details = details.parentElement?.closest('details') ?? null;
        }
      }}
      className={cn(
        'space-y-6',
        stickyActions &&
          '[&_p.text-xs]:text-sm [&_summary]:cursor-pointer [&_details]:rounded-lg [&_details]:border [&_details]:border-border-subtle [&_details]:bg-card [&_details]:p-4 sm:[&_details]:p-6 [&_:is(details,[data-slot=studio-detail-card])_:is(details,[data-slot=studio-detail-card])]:rounded-none [&_:is(details,[data-slot=studio-detail-card])_:is(details,[data-slot=studio-detail-card])]:border-0 [&_:is(details,[data-slot=studio-detail-card])_:is(details,[data-slot=studio-detail-card])]:bg-transparent [&_:is(details,[data-slot=studio-detail-card])_:is(details,[data-slot=studio-detail-card])]:p-0 [&_:is(details,[data-slot=studio-detail-card])_:is(details,[data-slot=studio-detail-card])]:shadow-none [&_summary]:text-sm [&_summary]:font-medium [&_details[open]>summary]:mb-4 [&_[id]]:scroll-mt-24 [&_:is(input,select,textarea,[contenteditable=true])]:scroll-mb-48',
        className
      )}
    >
      <StudioPageHeader
        title={title}
        description={description}
        actions={stickyActions ? actions : headerActions}
        withTitleAccessory
      />
      <div className={stickyActions ? 'space-y-6' : 'space-y-5'}>{children}</div>
      {primaryAction ? (
        <StudioFormActionBar
          className={
            stickyActions
              ? 'sticky bottom-0 z-20 rounded-lg border border-border-subtle bg-card p-4 shadow-sm [&_p]:max-w-2xl [&>div]:w-full [&>div]:items-end [&>div]:gap-3 [&>div>p]:order-first [&>div>p]:self-start sm:[&>div]:flex-row sm:[&>div]:justify-end sm:[&>div>p]:self-center sm:[&>div]:items-center sm:[&>div>p]:mr-auto'
              : undefined
          }
        >
          {primaryAction}
        </StudioFormActionBar>
      ) : null}
    </section>
  );
}
