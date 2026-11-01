import { EventsDetailCreate } from './events.detail-create.js';
import { loadEventsContentAssetSnapshot } from './events.detail-media-actions.js';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  ContentOwnershipPanelSlot,
  StudioDetailTabs,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';
import { EventsDetailBasisTab } from './events.detail-basis-tab.js';
import { EventsDetailContentTab } from './events.detail-content-tab.js';
import { EventsDetailSettingsTab } from './events.detail-settings-tab.js';
import { EventsDetailHistoryTab } from './events.detail-history-tab.js';
import { type EventsDetailTabDefinition, type EventsDetailTabId } from './events.detail-tabs.js';
import type { EventCategoryOption, EventContentItem } from './events.types.js';

type Props = Readonly<{
  pt: ReturnType<typeof usePluginTranslation>;
  mode: 'create' | 'edit';
  contentId?: string;
  tabs: readonly EventsDetailTabDefinition[];
  activeTab: EventsDetailTabId;
  handleTabChange: (tabId: EventsDetailTabId) => void;
  categoryOptions: readonly EventCategoryOption[];
  categoryOptionsError: string | null;
  categoryOptionsLoading: boolean;
  loadedItem: EventContentItem | null;
  mediaUsages: readonly ContentMediaUsage[];
  onChangeMediaUsages: (usages: readonly ContentMediaUsage[]) => void;
  addManualMedia: () => string;
  canSelectMedia: boolean;
  canUploadMedia: boolean;
  mediaEditingDisabled: boolean;
  onOpenMediaPicker: (mode: 'upload' | 'library') => void;
}>;

export function EventsDetailEditorTabs(props: Props) {
  const {
    pt,
    mode,
    contentId,
    tabs,
    activeTab,
    handleTabChange,
    categoryOptions,
    categoryOptionsError,
    categoryOptionsLoading,
    loadedItem,
    mediaUsages,
    onChangeMediaUsages,
    addManualMedia,
    canSelectMedia,
    canUploadMedia,
    mediaEditingDisabled,
    onOpenMediaPicker,
  } = props;
  if (mode === 'create') return <EventsDetailCreate {...props} />;
  return (
    <StudioDetailTabs<EventsDetailTabId>
      ariaLabel={pt('tabs.ariaLabel')}
      mobileSelectLabel={pt('tabs.mobileLabel')}
      value={activeTab}
      onValueChange={handleTabChange}
      keepMounted
      preloadOnIntent
      tabs={tabs.map((tab) => ({
        ...tab,
        icon: tab.id,
        panel: (
          <div className="space-y-4">
            {tab.id === 'basis' && mode === 'edit' ? <ContentOwnershipPanelSlot /> : null}
            {tab.id === 'basis' ? (
              <EventsDetailBasisTab
                availableCategories={categoryOptions}
                categoryOptionsError={categoryOptionsError}
                categoryOptionsLoading={categoryOptionsLoading}
                loadedItem={loadedItem}
                mode={mode}
                pt={pt}
              />
            ) : null}
            {tab.id === 'content' ? (
              <EventsDetailContentTab
                mediaUsages={mediaUsages}
                onAddManualMedia={addManualMedia}
                onChangeMediaUsages={onChangeMediaUsages}
                canSelectMedia={canSelectMedia}
                canUploadMedia={canUploadMedia}
                mediaEditingDisabled={mediaEditingDisabled}
                onLoadAssetSnapshot={loadEventsContentAssetSnapshot}
                onOpenMediaPicker={onOpenMediaPicker}
                pt={pt}
              />
            ) : null}
            {tab.id === 'settings' ? <EventsDetailSettingsTab pt={pt} /> : null}
            {tab.id === 'history' ? <EventsDetailHistoryTab contentId={contentId} pt={pt} /> : null}
          </div>
        ),
      }))}
    />
  );
}
