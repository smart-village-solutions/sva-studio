import { StudioDetailTabs, type StudioDetailTabDefinition } from '@sva/studio-ui-react';

import type { GenericItemCategoryOption } from './generic-items.api-types.js';
import { GenericItemsDetailBasisTab } from './generic-items.detail-basis-tab.js';
import { GenericItemsDetailContentTab } from './generic-items.detail-content-tab.js';
import { GenericItemsDetailHistoryTab } from './generic-items.detail-history-tab.js';
import { GenericItemsDetailSettingsTab } from './generic-items.detail-settings-tab.js';
import type { GenericItemsDetailTabId } from './generic-items.detail-tabs.js';

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
}>) => {
  const tabs: readonly StudioDetailTabDefinition<GenericItemsDetailTabId>[] = [
    {
      id: 'basis',
      label: pt('tabs.basis.label'),
      title: pt('tabs.basis.title'),
      description: pt('tabs.basis.description'),
      icon: 'basis',
      panel: (
        <GenericItemsDetailBasisTab
          availableCategories={categoryOptions}
          categoryOptionsError={categoryOptionsError}
          categoryOptionsLoading={categoryOptionsLoading}
          labels={labels}
        />
      ),
    },
    {
      id: 'content',
      label: pt('tabs.content.label'),
      title: pt('tabs.content.title'),
      description: pt('tabs.content.description'),
      icon: 'content',
      panel: <GenericItemsDetailContentTab labels={labels} onOpenMediaPicker={onOpenMediaPicker} />,
    },
    {
      id: 'settings',
      label: pt('tabs.settings.label'),
      title: pt('tabs.settings.title'),
      description: pt('tabs.settings.description'),
      icon: 'settings',
      panel: <GenericItemsDetailSettingsTab labels={labels} />,
    },
    {
      id: 'history',
      label: pt('tabs.history.label'),
      title: pt('tabs.history.title'),
      description: pt('tabs.history.description'),
      icon: 'history',
      panel: <GenericItemsDetailHistoryTab message={pt('history.placeholder')} />,
    },
  ];

  return (
    <StudioDetailTabs
      ariaLabel={pt('tabs.ariaLabel')}
      mobileSelectLabel={pt('tabs.mobileLabel')}
      tabs={tabs}
      value={activeTab}
      onValueChange={onTabChange}
      keepMounted
    />
  );
};
