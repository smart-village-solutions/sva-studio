import { PoiDetailCreate } from './poi.detail-create.js';
import { Button, StudioDetailTabs } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import { readSessionAccessSnapshot, usePluginTranslation } from '@sva/plugin-sdk';
import type { PoiDetailTabId } from './poi.detail-tabs.js';
import type { PoiDetailPageViewModel } from './poi.detail-page.view.js';
import { createPoiTabPanels } from './poi.detail-page.view-panels.js';

export function PoiDetailTabs({ view }: Readonly<{ view: PoiDetailPageViewModel }>) {
  const {
    mode,
    contentId,
    instanceId,
    categoryOptions,
    categoryOptionsError,
    categoryOptionsLoading,
    loadedItem,
    canSelectMedia,
    canUploadMedia,
    saveFeedback,
    media,
    pt,
    activeTab,
    handleTabChange,
    tabs,
  } = view;
  const tabPanels = createPoiTabPanels({
    mode,
    contentId,
    instanceId,
    categoryOptions,
    categoryOptionsError,
    categoryOptionsLoading,
    loadedItem,
    canSelectMedia,
    canUploadMedia,
    saveStatus: saveFeedback.status,
    media,
    pt,
  });
  if (mode === 'create') return <PoiDetailCreate view={view} content={tabPanels.content} />;
  return (
    <StudioDetailTabs<PoiDetailTabId>
      ariaLabel={pt('tabs.ariaLabel')}
      mobileSelectLabel={pt('tabs.mobileLabel')}
      value={activeTab}
      onValueChange={handleTabChange}
      keepMounted
      preloadOnIntent
      tabs={tabs.map((tab) => ({
        ...tab,
        icon: tab.id,
        actions: <PoiVoucherLink contentId={contentId} />,
        panel: tabPanels[tab.id],
      }))}
    />
  );
}

function PoiVoucherLink({ contentId }: Readonly<{ contentId?: string }>) {
  const session = readSessionAccessSnapshot();
  const pt = usePluginTranslation('poi');
  if (
    !contentId ||
    !session.assignedModules.includes('vouchers') ||
    !session.permissionActions.includes('vouchers.read')
  )
    return null;
  return (
    <Button asChild variant="secondary">
      <Link to="/admin/content" search={{ type: 'vouchers.voucher', poiId: contentId }}>
        {pt('messages.vouchersForLocation')}
      </Link>
    </Button>
  );
}
