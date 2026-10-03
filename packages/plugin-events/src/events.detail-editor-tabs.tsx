import { loadEventsContentAssetSnapshot } from './events.detail-media-actions.js';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  ContentOwnershipPanelSlot,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';
import { EventsDetailBasisTab } from './events.detail-basis-tab.js';
import { EventsDetailContentTab } from './events.detail-content-tab.js';
import { EventsDetailSettingsTab } from './events.detail-settings-tab.js';
import { EventsDetailHistoryTab } from './events.detail-history-tab.js';
import {
  eventsTabIconMap,
  type EventsDetailTabDefinition,
  type EventsDetailTabId,
} from './events.detail-tabs.js';
import type { EventCategoryOption, EventContentItem } from './events.types.js';

type Props = Readonly<{
  pt: ReturnType<typeof usePluginTranslation>;
  mode: 'create' | 'edit';
  contentId?: string;
  tabs: readonly EventsDetailTabDefinition[];
  activeTab: EventsDetailTabId;
  handleTabChange: (tabId: EventsDetailTabId) => void;
  warmTab: (tabId: EventsDetailTabId) => void;
  visitedTabs: readonly EventsDetailTabId[];
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

const EventsDetailTabNavigation = ({ pt, tabs, activeTab, handleTabChange, warmTab }: Props) => (
  <>
    <label className="block md:hidden">
      <span className="sr-only">{pt('tabs.mobileLabel')}</span>
      <Select
        aria-label={pt('tabs.mobileLabel')}
        className="h-11 rounded-xl border-border/70 bg-card"
        value={activeTab}
        onChange={(event) => handleTabChange(event.target.value as EventsDetailTabId)}
      >
        {tabs.map((tab) => (
          <option key={tab.id} value={tab.id}>
            {tab.label}
          </option>
        ))}
      </Select>
    </label>
    <TabsList aria-label={pt('tabs.ariaLabel')} className="ml-[10px] hidden gap-10 md:flex">
      {tabs.map((tab) => {
        const TabIcon = eventsTabIconMap[tab.id];
        const isActive = tab.id === activeTab;

        return (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            onClick={() => handleTabChange(tab.id)}
            onMouseEnter={() => warmTab(tab.id)}
            onFocus={() => warmTab(tab.id)}
            className={`relative z-10 gap-2 rounded-none border-x-0 border-t-0 border-b-[3px] px-0 pr-5 shadow-none ${
              isActive
                ? 'mb-[-1px] border-primary text-primary'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <TabIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
            </span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  </>
);

const EventsDetailTabPanels = ({
  pt,
  mode,
  contentId,
  tabs,
  activeTab,
  visitedTabs,
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
}: Props) => (
  <>
    {tabs.map((tab) => {
      const shouldKeepMounted = visitedTabs.includes(tab.id) && tab.id !== activeTab;

      return (
        <TabsContent
          key={tab.id}
          value={tab.id}
          forceMount={shouldKeepMounted || undefined}
          className="mt-0 data-[state=inactive]:hidden"
        >
          <div className="space-y-4 rounded-2xl border border-border/60 bg-[rgb(var(--waste-panel-surface))] p-5">
            {tab.id === 'basis' && mode === 'edit' ? <ContentOwnershipPanelSlot /> : null}
            <section
              aria-label={tab.title}
              className="flex flex-col gap-3 border-0 bg-transparent p-0 lg:flex-row lg:items-start lg:justify-between"
            >
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground">{tab.title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{tab.description}</p>
              </div>
            </section>
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
        </TabsContent>
      );
    })}
  </>
);

export function EventsDetailEditorTabs(props: Props) {
  return (
    <Tabs
      value={props.activeTab}
      onValueChange={(value) => props.handleTabChange(value as EventsDetailTabId)}
      className="space-y-0"
    >
      <EventsDetailTabNavigation {...props} />
      <EventsDetailTabPanels {...props} />
    </Tabs>
  );
}
