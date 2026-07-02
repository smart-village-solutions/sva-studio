import * as React from 'react';

import { Tabs } from './tabs.js';
import { cn } from './utils.js';
import {
  StudioDetailTabsMobileSelect,
  StudioDetailTabsPanel,
  StudioDetailTabsStatus,
  StudioDetailTabsTriggerList,
} from './studio-detail-tabs.parts.js';

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

export type StudioDetailTab<TTabId extends string = string> =
  | StudioDetailTabDefinition<TTabId>
  | StudioDetailTabLegacy<TTabId>;

export type StudioDetailTabsProps<TTabId extends string = string> = Readonly<{
  ariaLabel: string;
  mobileSelectLabel?: string;
  tabs: readonly StudioDetailTab<TTabId>[];
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

function isLegacyTab<TTabId extends string>(tab: StudioDetailTab<TTabId>): tab is StudioDetailTabLegacy<TTabId> {
  return 'content' in tab;
}

function getTabPanel<TTabId extends string>(tab: StudioDetailTab<TTabId>) {
  return isLegacyTab(tab) ? tab.content : tab.panel;
}

function getTabDescription<TTabId extends string>(tab: StudioDetailTab<TTabId>) {
  return tab.description;
}

function getTabTitle<TTabId extends string>(tab: StudioDetailTab<TTabId>) {
  if (tab.title) {
    return tab.title;
  }

  return isLegacyTab(tab) ? undefined : tab.label;
}

function isTabVisible<TTabId extends string>(tab: StudioDetailTab<TTabId>) {
  return tab.isVisible !== false;
}

function tabHasChanges<TTabId extends string>(tab: StudioDetailTab<TTabId>) {
  return tab.hasChanges ?? (isLegacyTab(tab) ? (tab.isDirty ?? false) : false);
}

function getChangeLabel<TTabId extends string>(tab: StudioDetailTab<TTabId>) {
  return tab.changeLabel ?? (isLegacyTab(tab) ? tab.dirtyLabel : undefined);
}

function getMobileOptionLabel<TTabId extends string>(tab: StudioDetailTab<TTabId>) {
  const baseLabel = typeof tab.label === 'string' ? tab.label : tab.id;
  const changeLabel = getChangeLabel(tab);
  return tabHasChanges(tab) && changeLabel ? `${baseLabel} (${changeLabel})` : baseLabel;
}

function renderTabLabel<TTabId extends string>(tab: StudioDetailTab<TTabId>) {
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
    <Tabs value={currentValue} onValueChange={handleValueChange} className={cn('space-y-0', className)}>
      <StudioDetailTabsMobileSelect
        mobileSelectLabel={mobileSelectLabel}
        currentValue={currentValue}
        visibleTabs={visibleTabs}
        getMobileOptionLabel={getMobileOptionLabel}
        onChange={handleValueChange}
      />
      <StudioDetailTabsTriggerList
        ariaLabel={ariaLabel}
        visibleTabs={visibleTabs}
        renderTabLabel={renderTabLabel}
        onChange={handleValueChange}
      />
      <StudioDetailTabsStatus status={status} statusMessage={statusMessage} statusAriaLive={statusAriaLive} />

      {visibleTabs.map((tab) => {
        const title = getTabTitle(tab);
        const description = getTabDescription(tab);
        const shouldForceMount = keepMounted && visitedTabs.has(tab.id);
        return (
          <StudioDetailTabsPanel
            key={tab.id}
            tab={tab}
            title={title}
            description={description}
            shouldForceMount={shouldForceMount}
          >
            {getTabPanel(tab)}
          </StudioDetailTabsPanel>
        );
      })}
    </Tabs>
  );
}
