import { ContentMediaUsageBlock, StudioDetailTabs, type ContentMediaUsage, type StudioDetailTabDefinition } from '@sva/studio-ui-react';
import type React from 'react';

import type { GenericItemCategoryOption } from './generic-items.api-types.js';
import { GenericItemsDetailBasisTab } from './generic-items.detail-basis-tab.js';
import { GenericItemsDetailContentTab } from './generic-items.detail-content-tab.js';
import { GenericItemsDetailHistoryTab } from './generic-items.detail-history-tab.js';
import { GenericItemsDetailSettingsTab } from './generic-items.detail-settings-tab.js';
import type { GenericItemsDetailTabId } from './generic-items.detail-tabs.js';

type GenericItemsDetailTabsProps = Readonly<{
  activeTab: GenericItemsDetailTabId;
  categoryOptions: readonly GenericItemCategoryOption[];
  categoryOptionsError: string | null;
  categoryOptionsLoading: boolean;
  contentId?: string;
  labels: Record<string, string>;
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
  onTabChange: (tabId: GenericItemsDetailTabId) => void;
  pt: (key: string) => string;
  mediaUsages?: readonly ContentMediaUsage[];
  onChangeMediaUsages?: (usages: readonly ContentMediaUsage[]) => void;
  canSelectMedia?: boolean;
  canUploadMedia?: boolean;
  onLoadAssetSnapshot?: React.ComponentProps<typeof ContentMediaUsageBlock>['onLoadAssetSnapshot'];
}>;

const createGenericItemsDetailTabs = ({
  categoryOptions, categoryOptionsError, categoryOptionsLoading, contentId, labels, onOpenMediaPicker, pt,
  mediaUsages, onChangeMediaUsages, canSelectMedia, canUploadMedia, onLoadAssetSnapshot,
}: GenericItemsDetailTabsProps): readonly StudioDetailTabDefinition<GenericItemsDetailTabId>[] => [
  {
    id: 'basis', label: pt('tabs.basis.label'), title: pt('tabs.basis.title'),
    description: pt('tabs.basis.description'), icon: 'basis',
    panel: <GenericItemsDetailBasisTab availableCategories={categoryOptions} categoryOptionsError={categoryOptionsError} categoryOptionsLoading={categoryOptionsLoading} labels={labels} />,
  },
  {
    id: 'content', label: pt('tabs.content.label'), title: pt('tabs.content.title'),
    description: pt('tabs.content.description'), icon: 'content',
    panel: <GenericItemsDetailContentTab labels={labels} onOpenMediaPicker={onOpenMediaPicker} mediaUsages={mediaUsages} onChangeMediaUsages={onChangeMediaUsages} canSelectMedia={canSelectMedia} canUploadMedia={canUploadMedia} onLoadAssetSnapshot={onLoadAssetSnapshot} />,
  },
  {
    id: 'settings', label: pt('tabs.settings.label'), title: pt('tabs.settings.title'),
    description: pt('tabs.settings.description'), icon: 'settings',
    panel: <GenericItemsDetailSettingsTab labels={labels} />,
  },
  {
    id: 'history', label: pt('tabs.history.label'), title: pt('tabs.history.title'),
    description: pt('tabs.history.description'), icon: 'history',
    panel: <GenericItemsDetailHistoryTab contentId={contentId} pt={pt} />,
  },
];

export const GenericItemsDetailTabs = ({
  activeTab,
  categoryOptions,
  categoryOptionsError,
  categoryOptionsLoading,
  contentId,
  labels,
  onOpenMediaPicker,
  onTabChange,
  pt,
  mediaUsages,
  onChangeMediaUsages,
  canSelectMedia,
  canUploadMedia,
  onLoadAssetSnapshot,
}: GenericItemsDetailTabsProps) => {
  const tabs = createGenericItemsDetailTabs({ activeTab, categoryOptions, categoryOptionsError, categoryOptionsLoading, contentId, labels, onOpenMediaPicker, onTabChange, pt, mediaUsages, onChangeMediaUsages, canSelectMedia, canUploadMedia, onLoadAssetSnapshot });

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
