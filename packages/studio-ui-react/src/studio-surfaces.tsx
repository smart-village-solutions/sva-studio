import * as React from 'react';

import { Button, type ButtonProps } from './button.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.js';
import { cn } from './utils.js';

export type StudioResourceHeaderMetaItem = Readonly<{
  id: string;
  label: React.ReactNode;
  value: React.ReactNode;
}>;

export type StudioResourceHeaderProps = Readonly<{
  title: React.ReactNode;
  description?: React.ReactNode;
  media?: React.ReactNode;
  status?: React.ReactNode;
  metadata?: readonly StudioResourceHeaderMetaItem[];
  actions?: React.ReactNode;
  className?: string;
}>;

export function StudioResourceHeader({
  title,
  description,
  media,
  status,
  metadata = [],
  actions,
  className,
}: StudioResourceHeaderProps) {
  return (
    <section className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-3">
          {media ? <div className="shrink-0">{media}</div> : null}
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-xl font-semibold text-foreground">{title}</h2>
              {status}
            </div>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">{actions}</div> : null}
      </div>
      {metadata.length > 0 ? (
        <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {metadata.map((item) => (
            <div key={item.id} className="min-w-0">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 break-words text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

export type StudioSectionProps = Readonly<{
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}>;

export function StudioSection({ title, description, actions, children, className }: StudioSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      {title || description || actions ? (
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? <h2 className="text-lg font-semibold text-foreground">{title}</h2> : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export type StudioEditSurfaceProps = Readonly<{
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}>;

export function StudioEditSurface({ children, footer, className }: StudioEditSurfaceProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4 shadow-sm', className)}>
      <div className="space-y-5">{children}</div>
      {footer ? <div className="mt-6 border-t border-border pt-4">{footer}</div> : null}
    </div>
  );
}

export type StudioDetailTab = Readonly<{
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  content: React.ReactNode;
}>;

export type StudioDetailTabsProps = Readonly<{
  ariaLabel: string;
  tabs: readonly StudioDetailTab[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}>;

export function StudioDetailTabs({
  ariaLabel,
  tabs,
  defaultValue,
  value,
  onValueChange,
  className,
}: StudioDetailTabsProps) {
  const firstTab = tabs[0]?.id;

  return (
    <Tabs
      defaultValue={defaultValue ?? firstTab}
      value={value}
      onValueChange={onValueChange}
      className={cn('space-y-4', className)}
    >
      <TabsList aria-label={ariaLabel}>
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
  );
}

export type StudioActionMenuItem = Readonly<{
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  variant?: ButtonProps['variant'];
  onSelect?: () => void;
  render?: React.ReactNode;
}>;

export type StudioActionMenuProps = Readonly<{
  items: readonly StudioActionMenuItem[];
  className?: string;
}>;

export function StudioActionMenu({ items, className }: StudioActionMenuProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {items.map((item) =>
        item.render ? (
          <React.Fragment key={item.id}>{item.render}</React.Fragment>
        ) : (
          <Button
            key={item.id}
            type="button"
            variant={item.variant ?? 'outline'}
            disabled={item.disabled}
            onClick={item.onSelect}
          >
            {item.icon}
            {item.label}
          </Button>
        )
      )}
    </div>
  );
}
