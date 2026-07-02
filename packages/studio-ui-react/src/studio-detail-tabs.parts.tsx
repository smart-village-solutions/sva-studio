import * as React from 'react';

import { TabsContent, TabsList, TabsTrigger } from './tabs.js';
import { cn } from './utils.js';
import type { StudioDetailTab, StudioDetailTabsProps } from './studio-detail-tabs.js';

export function StudioDetailTabsMobileSelect<TTabId extends string>({
  mobileSelectLabel,
  currentValue,
  visibleTabs,
  getMobileOptionLabel,
  onChange,
}: Readonly<{
  mobileSelectLabel: string;
  currentValue: TTabId | undefined;
  visibleTabs: readonly StudioDetailTab<TTabId>[];
  getMobileOptionLabel: (tab: StudioDetailTab<TTabId>) => string;
  onChange: (value: string) => void;
}>) {
  return (
    <label className="block md:hidden">
      <span className="text-sm font-medium text-foreground">{mobileSelectLabel}</span>
      <select
        aria-label={mobileSelectLabel}
        className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        value={currentValue}
        onChange={(event) => onChange(event.target.value)}
      >
        {visibleTabs.map((tab) => (
          <option key={tab.id} value={tab.id} disabled={tab.disabled} label={getMobileOptionLabel(tab)} />
        ))}
      </select>
    </label>
  );
}

export function StudioDetailTabsTriggerList<TTabId extends string>({
  ariaLabel,
  visibleTabs,
  renderTabLabel,
  onChange,
}: Readonly<{
  ariaLabel: string;
  visibleTabs: readonly StudioDetailTab<TTabId>[];
  renderTabLabel: (tab: StudioDetailTab<TTabId>) => React.ReactNode;
  onChange: (value: string) => void;
}>) {
  const enabledTabs = visibleTabs.filter((tab) => !tab.disabled);

  return (
    <TabsList aria-label={ariaLabel} className="ml-[10px] hidden gap-10 md:flex">
      {visibleTabs.map((tab) => (
        <TabsTrigger
          key={tab.id}
          value={tab.id}
          disabled={tab.disabled}
          className={cn(
            'relative z-10 justify-start whitespace-normal text-left gap-2 rounded-none border-x-0 border-t-0 px-0 pr-5 shadow-none',
            'data-[state=active]:mb-[-1px] data-[state=active]:border-primary data-[state=active]:text-primary',
            'data-[state=inactive]:border-transparent data-[state=inactive]:text-muted-foreground'
          )}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            const currentIndex = enabledTabs.findIndex((candidate) => candidate.id === tab.id);
            if (currentIndex === -1) {
              return;
            }

            const moveToIndex = (targetIndex: number) => {
              const targetTab = enabledTabs[targetIndex];
              if (!targetTab) {
                return;
              }
              event.preventDefault();
              onChange(targetTab.id);
            };

            switch (event.key) {
              case 'ArrowRight':
              case 'ArrowDown':
                moveToIndex((currentIndex + 1) % enabledTabs.length);
                break;
              case 'ArrowLeft':
              case 'ArrowUp':
                moveToIndex((currentIndex - 1 + enabledTabs.length) % enabledTabs.length);
                break;
              case 'Home':
                moveToIndex(0);
                break;
              case 'End':
                moveToIndex(enabledTabs.length - 1);
                break;
              default:
                break;
            }
          }}
        >
          {renderTabLabel(tab)}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

export function StudioDetailTabsStatus({
  status,
  statusMessage,
  statusAriaLive,
}: Pick<StudioDetailTabsProps, 'status' | 'statusAriaLive'> & { readonly statusMessage?: string }) {
  if (!status && !statusMessage) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live={statusAriaLive}
      className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
    >
      {status ? <div>{status}</div> : null}
      {statusMessage ? <p>{statusMessage}</p> : null}
    </div>
  );
}

export function StudioDetailTabsPanel<TTabId extends string>({
  tab,
  title,
  description,
  shouldForceMount,
  children,
}: Readonly<{
  tab: StudioDetailTab<TTabId>;
  title?: React.ReactNode;
  description?: React.ReactNode;
  shouldForceMount: boolean;
  children: React.ReactNode;
}>) {
  const shouldRenderHeader = Boolean(title || description || tab.actions);
  return (
    <TabsContent
      value={tab.id}
      className="mt-0 data-[state=inactive]:hidden"
      {...(shouldForceMount ? { forceMount: true } : {})}
    >
      <div className="space-y-4 rounded-2xl border border-border/60 bg-[rgb(var(--waste-panel-surface))] p-5">
        {shouldRenderHeader ? (
          <section
            aria-label={typeof tab.label === 'string' ? tab.label : undefined}
            className="flex flex-col gap-3 border-0 bg-transparent p-0 lg:flex-row lg:items-start lg:justify-between"
          >
            <div className="space-y-1">
              {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
              {description ? <p className="text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
            </div>
            {tab.actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">{tab.actions}</div> : null}
          </section>
        ) : null}
        <div>{children}</div>
      </div>
    </TabsContent>
  );
}
