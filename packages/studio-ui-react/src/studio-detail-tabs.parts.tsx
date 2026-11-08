import * as React from 'react';

import { TabsContent, TabsList, TabsTrigger } from './tabs.js';
import { cn } from './utils.js';
import type { StudioDetailTab, StudioDetailTabsProps } from './studio-detail-tabs.js';
import { Select } from './select.js';

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
      <Select
        aria-label={mobileSelectLabel}
        className="mt-2"
        value={currentValue}
        onChange={(event) => onChange(event.target.value)}
      >
        {visibleTabs.map((tab) => (
          <option
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            label={getMobileOptionLabel(tab)}
          />
        ))}
      </Select>
    </label>
  );
}

export function StudioDetailTabsTriggerList<TTabId extends string>({
  ariaLabel,
  visibleTabs,
  renderTabLabel,
  onChange,
  onIntent,
}: Readonly<{
  ariaLabel: string;
  visibleTabs: readonly StudioDetailTab<TTabId>[];
  renderTabLabel: (tab: StudioDetailTab<TTabId>) => React.ReactNode;
  onChange: (value: string) => void;
  onIntent?: (value: TTabId) => void;
}>) {
  return (
    <TabsList
      aria-label={ariaLabel}
      className="hidden w-full min-w-0 max-w-full gap-0 overflow-x-auto md:flex"
    >
      {visibleTabs.map((tab) => (
        <TabsTrigger
          key={tab.id}
          value={tab.id}
          disabled={tab.disabled}
          className={cn(
            'relative z-10 min-h-11 shrink-0 justify-center gap-2 whitespace-nowrap rounded-none border-x-0 border-t-0 border-b-[3px] px-4 py-2 text-left shadow-none',
            'data-[state=active]:mb-[-1px] data-[state=active]:border-primary data-[state=active]:text-primary',
            'data-[state=inactive]:border-transparent data-[state=inactive]:text-muted-foreground'
          )}
          onClick={() => onChange(tab.id)}
          onMouseEnter={() => onIntent?.(tab.id)}
          onFocus={() => onIntent?.(tab.id)}
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
      <div className="space-y-4 rounded-lg border border-border-subtle bg-surface-inset p-4 sm:p-6">
        {shouldRenderHeader ? (
          <section
            aria-label={typeof tab.label === 'string' ? tab.label : undefined}
            className="flex flex-col gap-3 border-0 bg-transparent p-0 lg:flex-row lg:items-start lg:justify-between"
          >
            <div className="min-w-0 space-y-1">
              {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
              {description ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {tab.actions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                {tab.actions}
              </div>
            ) : null}
          </section>
        ) : null}
        <div>{children}</div>
      </div>
    </TabsContent>
  );
}
