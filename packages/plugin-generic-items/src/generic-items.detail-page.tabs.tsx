import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@sva/studio-ui-react';

import { GenericItemsDetailBasisTab } from './generic-items.detail-basis-tab.js';
import { GenericItemsDetailContentTab } from './generic-items.detail-content-tab.js';
import { GenericItemsDetailHistoryTab } from './generic-items.detail-history-tab.js';
import { GenericItemsDetailSettingsTab } from './generic-items.detail-settings-tab.js';
import { genericItemsDetailTabIds, type GenericItemsDetailTabId } from './generic-items.detail-tabs.js';
import type { GenericItemCategoryOption } from './generic-items.api-types.js';
import type { HostMediaAssetListItem } from '@sva/plugin-sdk';

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
  mediaAssets,
  onTabChange,
  onUploadFile,
  pt,
}: Readonly<{
  activeTab: GenericItemsDetailTabId;
  categoryOptions: readonly GenericItemCategoryOption[];
  categoryOptionsError: string | null;
  categoryOptionsLoading: boolean;
  labels: Record<string, string>;
  mediaAssets: readonly HostMediaAssetListItem[];
  onTabChange: (tabId: GenericItemsDetailTabId) => void;
  onUploadFile: (file: File) => Promise<HostMediaAssetListItem>;
  pt: (key: string) => string;
}>) => (
  <Tabs value={activeTab} onValueChange={(value: string) => onTabChange(value as GenericItemsDetailTabId)}>
    <TabsList aria-label={pt('tabs.ariaLabel')}>
      {genericItemsDetailTabIds.map((tabId) => (
        <TabsTrigger key={tabId} value={tabId}>
          {pt(`tabs.${tabId}.label`)}
        </TabsTrigger>
      ))}
    </TabsList>

    <TabsContent value="basis">
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
    <TabsContent value="content">
      {renderTabPanel(
        pt('tabs.content.title'),
        pt('tabs.content.description'),
        <GenericItemsDetailContentTab labels={labels} mediaAssets={mediaAssets} onUploadFile={onUploadFile} />
      )}
    </TabsContent>
    <TabsContent value="settings">
      {renderTabPanel(
        pt('tabs.settings.title'),
        pt('tabs.settings.description'),
        <GenericItemsDetailSettingsTab labels={labels} />
      )}
    </TabsContent>
    <TabsContent value="history">
      {renderTabPanel(
        pt('tabs.history.title'),
        pt('tabs.history.description'),
        <GenericItemsDetailHistoryTab message={pt('history.placeholder')} />
      )}
    </TabsContent>
  </Tabs>
);
