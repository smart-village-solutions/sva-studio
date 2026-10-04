import { GenericItemsDetailTabs } from './generic-items.detail-page.tabs.js';
import type { GenericItemsDetailPageViewModel } from './generic-items.detail-page.view-content.js';

export const GenericItemsEditorTabsView = ({
  view,
}: Readonly<{ view: GenericItemsDetailPageViewModel }>) => {
  const {
    activeTab,
    categoryOptions,
    categoryOptionsError,
    categoryOptionsLoading,
    contentId,
    labels,
    addManualMedia,
    mediaPicker,
    setActiveTab,
    pt,
    mediaUsages,
    setMediaUsages,
    setRequiresReferenceSync,
    canSelectMedia,
    canUploadMedia,
    saveFeedback,
    getAssetSnapshot,
  } = view;
  return (
    <GenericItemsDetailTabs
      activeTab={activeTab}
      categoryOptions={categoryOptions}
      categoryOptionsError={categoryOptionsError}
      categoryOptionsLoading={categoryOptionsLoading}
      contentId={contentId}
      labels={labels}
      onAddManualMedia={addManualMedia}
      onOpenMediaPicker={(pickerMode) =>
        pickerMode === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()
      }
      onTabChange={setActiveTab}
      pt={pt}
      mediaUsages={mediaUsages}
      onChangeMediaUsages={(usages) => {
        setMediaUsages(usages);
        setRequiresReferenceSync(
          (current) => current || usages.some((usage) => Boolean(usage.assetId))
        );
      }}
      canSelectMedia={canSelectMedia}
      canUploadMedia={canUploadMedia}
      mediaEditingDisabled={saveFeedback.status === 'saving'}
      onLoadAssetSnapshot={getAssetSnapshot}
    />
  );
};
