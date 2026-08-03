import React from 'react';
import {
  StudioDetailTabIcon,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type StudioDetailTabIconName,
} from '@sva/studio-ui-react';

import { GenericItemsDetailBasisTab } from './generic-items.detail-basis-tab.js';
import { GenericItemsDetailContentTab } from './generic-items.detail-content-tab.js';
import { GenericItemsDetailHistoryTab } from './generic-items.detail-history-tab.js';
import { GenericItemsDetailSettingsTab } from './generic-items.detail-settings-tab.js';
import {
  genericItemsDetailTabIds,
  type GenericItemsDetailTabId,
} from './generic-items.detail-tabs.js';
import type { GenericItemCategoryOption } from './generic-items.api-types.js';

const tabIconNames = {
  basis: 'basis',
  content: 'content',
  settings: 'settings',
  history: 'history',
} as const satisfies Record<GenericItemsDetailTabId, StudioDetailTabIconName>;

const renderTabPanel = (title: string, description: string, panel: React.JSX.Element) => (
  <div className="space-y-4 rounded-2xl border border-border/60 bg-[rgb(var(--waste-panel-surface))] p-5">
    <section className="space-y-1">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </section>
    {panel}
  </div>
);

export const GenericItemsDetailTabs = ({
  activeTab,
  categoryOptions,
  categoryOptionsError,
  categoryOptionsLoading,
  labels,
  onOpenMediaPicker,
  onTabChange,
  pt,
}: Readonly<{
  activeTab: GenericItemsDetailTabId;
  categoryOptions: readonly GenericItemCategoryOption[];
  categoryOptionsError: string | null;
  categoryOptionsLoading: boolean;
  labels: Record<string, string>;
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
  onTabChange: (tabId: GenericItemsDetailTabId) => void;
  pt: (key: string) => string;
}>) => (
  <Tabs
    value={activeTab}
    onValueChange={(value: string) => onTabChange(value as GenericItemsDetailTabId)}
    className="space-y-0"
  >
    <TabsList aria-label={pt('tabs.ariaLabel')} className="ml-[10px] gap-10">
      {genericItemsDetailTabIds.map((tabId) => (
        <TabsTrigger
          key={tabId}
          value={tabId}
          className="gap-2 rounded-none border-x-0 border-t-0 border-b-[3px] px-0 pr-5 shadow-none"
        >
          <StudioDetailTabIcon name={tabIconNames[tabId]} />
          <span>{pt(`tabs.${tabId}.label`)}</span>
        </TabsTrigger>
      ))}
    </TabsList>

    <TabsContent value="basis" className="mt-0">
      {renderTabPanel(
        pt('tabs.basis.title'),
        pt('tabs.basis.description'),
        <GenericItemsDetailBasisTab
          availableCategories={categoryOptions}
          categoryOptionsError={categoryOptionsError}
          categoryOptionsLoading={categoryOptionsLoading}
          labels={labels}
        />
      )}
    </TabsContent>
    <TabsContent value="content" className="mt-0">
      {renderTabPanel(
        pt('tabs.content.title'),
        pt('tabs.content.description'),
        <GenericItemsDetailContentTab labels={labels} onOpenMediaPicker={onOpenMediaPicker} />
      )}
    </TabsContent>
    <TabsContent value="settings" className="mt-0">
      {renderTabPanel(
        pt('tabs.settings.title'),
        pt('tabs.settings.description'),
        <GenericItemsDetailSettingsTab labels={labels} />
      )}
    </TabsContent>
    <TabsContent value="history" className="mt-0">
      {renderTabPanel(
        pt('tabs.history.title'),
        pt('tabs.history.description'),
        <GenericItemsDetailHistoryTab message={pt('history.placeholder')} />
      )}
    </TabsContent>
  </Tabs>
);
