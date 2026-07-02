import * as React from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.js';
import { cn } from './utils.js';

export type StudioDetailTabDefinition<TTabId extends string> = Readonly<{
  id: TTabId;
  label: string;
  title?: React.ReactNode;
  description?: string;
  isVisible?: boolean;
  hasChanges?: boolean;
  changeLabel?: string;
  disabled?: boolean;
  actions?: React.ReactNode;
  panel: React.ReactNode;
}>;

type StudioDetailTabLegacy<TTabId extends string> = Readonly<{
  id: TTabId;
  label: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  isVisible?: boolean;
  hasChanges?: boolean;
  changeLabel?: string;
  dirtyLabel?: string;
  isDirty?: boolean;
  disabled?: boolean;
  actions?: React.ReactNode;
  content: React.ReactNode;
}>;

export type StudioDetailTab<TTabId extends string = string> = StudioDetailTabDefinition<TTabId>;

export type StudioDetailTabsProps<TTabId extends string = string> = Readonly<{
  ariaLabel: string;
  mobileSelectLabel?: string;
  tabs: readonly (StudioDetailTabDefinition<TTabId> | StudioDetailTabLegacy<TTabId>)[];
  defaultValue?: TTabId;
  value?: TTabId;
  onValueChange?: (value: TTabId) => void;
  onBeforeTabChange?: (context: Readonly<{ currentValue: TTabId; nextValue: TTabId }>) => boolean | string | void;
  blockedTabChangeMessage?: string;
  keepMounted?: boolean;
  status?: React.ReactNode;
  statusAriaLive?: 'polite' | 'assertive' | 'off';
  className?: string;
}>;

function isLegacyTab<TTabId extends string>(
  tab: StudioDetailTabDefinition<TTabId> | StudioDetailTabLegacy<TTabId>
): tab is StudioDetailTabLegacy<TTabId> {
  return 'content' in tab;
}

function getTabPanel<TTabId extends string>(tab: StudioDetailTabDefinition<TTabId> | StudioDetailTabLegacy<TTabId>) {
  return isLegacyTab(tab) ? tab.content : tab.panel;
}

function getTabDescription<TTabId extends string>(
  tab: StudioDetailTabDefinition<TTabId> | StudioDetailTabLegacy<TTabId>
) {
  return tab.description;
}

function getTabTitle<TTabId extends string>(tab: StudioDetailTabDefinition<TTabId> | StudioDetailTabLegacy<TTabId>) {
  if (tab.title) {
    return tab.title;
  }

  return isLegacyTab(tab) ? undefined : tab.label;
}

function isTabVisible<TTabId extends string>(tab: StudioDetailTabDefinition<TTabId> | StudioDetailTabLegacy<TTabId>) {
  return tab.isVisible !== false;
}

function tabHasChanges<TTabId extends string>(tab: StudioDetailTabDefinition<TTabId> | StudioDetailTabLegacy<TTabId>) {
  return tab.hasChanges ?? (isLegacyTab(tab) ? (tab.isDirty ?? false) : false);
}

function getChangeLabel<TTabId extends string>(tab: StudioDetailTabDefinition<TTabId> | StudioDetailTabLegacy<TTabId>) {
  return tab.changeLabel ?? (isLegacyTab(tab) ? tab.dirtyLabel : undefined);
}

function getMobileOptionLabel<TTabId extends string>(
  tab: StudioDetailTabDefinition<TTabId> | StudioDetailTabLegacy<TTabId>
) {
  const baseLabel = typeof tab.label === 'string' ? tab.label : tab.id;
  const changeLabel = getChangeLabel(tab);
  return tabHasChanges(tab) && changeLabel ? `${baseLabel} (${changeLabel})` : baseLabel;
}

function renderTabLabel<TTabId extends string>(tab: StudioDetailTabDefinition<TTabId> | StudioDetailTabLegacy<TTabId>) {
  const changeLabel = getChangeLabel(tab);

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{tab.label}</span>
      {tabHasChanges(tab) && changeLabel ? (
        <span className="text-xs font-medium text-foreground">
          {changeLabel}
        </span>
      ) : null}
    </span>
  );
}

export function StudioDetailTabs<TTabId extends string = string>({
  ariaLabel,
  mobileSelectLabel = ariaLabel,
  tabs,
  defaultValue,
  value,
  onValueChange,
  onBeforeTabChange,
  blockedTabChangeMessage,
  keepMounted = false,
  status,
  statusAriaLive = 'polite',
  className,
}: StudioDetailTabsProps<TTabId>) {
  const visibleTabs = React.useMemo(() => tabs.filter(isTabVisible), [tabs]);
  const firstTabId = visibleTabs[0]?.id;
  const [internalValue, setInternalValue] = React.useState<TTabId | undefined>(defaultValue ?? firstTabId);
  const requestedValue = value ?? internalValue ?? defaultValue ?? firstTabId;
  const currentValue = visibleTabs.some((tab) => tab.id === requestedValue) ? requestedValue : firstTabId;
  const [statusMessage, setStatusMessage] = React.useState<string>();
  const [visitedTabs, setVisitedTabs] = React.useState<ReadonlySet<TTabId>>(
    () => new Set(currentValue ? [currentValue] : [])
  );

  React.useEffect(() => {
    if (!currentValue) {
      return;
    }

    setVisitedTabs((previousTabs) => {
      if (previousTabs.has(currentValue)) {
        return previousTabs;
      }

      const nextTabs = new Set(previousTabs);
      nextTabs.add(currentValue);
      return nextTabs;
    });
  }, [currentValue]);

  const handleValueChange = React.useCallback(
    (nextValue: string) => {
      const resolvedNextValue = nextValue as TTabId;
      if (!currentValue || resolvedNextValue === currentValue) {
        return;
      }

      const nextTab = visibleTabs.find((tab) => tab.id === resolvedNextValue);
      if (nextTab?.disabled) {
        return;
      }

      const switchGuardResult = onBeforeTabChange?.({
        currentValue,
        nextValue: resolvedNextValue,
      });

      if (switchGuardResult === false || typeof switchGuardResult === 'string') {
        setStatusMessage(typeof switchGuardResult === 'string' ? switchGuardResult : blockedTabChangeMessage);
        return;
      }

      setStatusMessage(undefined);
      if (value === undefined) {
        setInternalValue(resolvedNextValue);
      }
      onValueChange?.(resolvedNextValue);
    },
    [currentValue, onBeforeTabChange, onValueChange, value, visibleTabs]
  );

  return (
    <Tabs value={currentValue} className={cn('space-y-0', className)}>
      <label className="block md:hidden">
          <span className="text-sm font-medium text-foreground">{mobileSelectLabel}</span>
          <select
            aria-label={mobileSelectLabel}
            className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            value={currentValue}
            onChange={(event) => handleValueChange(event.target.value)}
          >
            {visibleTabs.map((tab) => (
              <option
                key={tab.id}
                value={tab.id}
                disabled={tab.disabled}
                label={getMobileOptionLabel(tab)}
              />
            ))}
          </select>
      </label>

      <TabsList aria-label={ariaLabel} className="ml-[10px] hidden gap-10 md:flex">
          {visibleTabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              disabled={tab.disabled}
              className={cn(
                'relative z-10 justify-start whitespace-normal text-left gap-2 rounded-none border-x-0 border-t-0 px-0 pr-5 shadow-none',
                currentValue === tab.id
                  ? 'mb-[-1px] border-primary text-primary'
                  : 'border-transparent text-muted-foreground'
              )}
              onClick={() => handleValueChange(tab.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleValueChange(tab.id);
                }
              }}
            >
              {renderTabLabel(tab)}
            </TabsTrigger>
          ))}
      </TabsList>

      {status || statusMessage ? (
        <div
          role="status"
          aria-live={statusAriaLive}
          className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
        >
          {status ? <div>{status}</div> : null}
          {statusMessage ? <p>{statusMessage}</p> : null}
        </div>
      ) : null}

      {visibleTabs.map((tab) => {
        const title = getTabTitle(tab);
        const description = getTabDescription(tab);
        const shouldForceMount = keepMounted && visitedTabs.has(tab.id);
        const shouldRenderHeader = Boolean(title || description || tab.actions);

        return (
          <TabsContent
            key={tab.id}
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
              <div>{getTabPanel(tab)}</div>
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
