import {
  Select,
  StudioDetailTabIcon,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sva/studio-ui-react';
import React from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import type { PoiDetailTabDefinition, PoiDetailTabId } from './poi.detail-tabs.js';
import type { PoiDetailPageViewModel } from './poi.detail-page.view.js';
import { createPoiTabPanels } from './poi.detail-page.view-panels.js';

const PoiTabTriggerLabel = ({ label }: Readonly<{ label: string }>) => <span>{label}</span>;

type TabsInput = Readonly<{
  activeTab: PoiDetailTabId;
  tabs: readonly PoiDetailTabDefinition[];
  pt: ReturnType<typeof usePluginTranslation>;
  handleTabChange: (tab: PoiDetailTabId) => void;
  warmTab: (tab: PoiDetailTabId) => void;
}>;

export function PoiDetailTabNavigation({
  activeTab,
  tabs,
  pt,
  handleTabChange,
  warmTab,
}: TabsInput) {
  return (
    <>
      <label className="block md:hidden">
        <span className="sr-only">{pt('tabs.mobileLabel')}</span>
        <Select
          aria-label={pt('tabs.mobileLabel')}
          className="h-11 rounded-xl border-border/70 bg-card"
          value={activeTab}
          onChange={(event) => handleTabChange(event.target.value as PoiDetailTabId)}
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
          const isActive = tab.id === activeTab;

          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              onMouseEnter={() => warmTab(tab.id)}
              onFocus={() => warmTab(tab.id)}
              className={`relative z-10 rounded-none border-x-0 border-t-0 border-b-[3px] px-0 pr-5 shadow-none ${
                isActive
                  ? 'mb-[-1px] border-primary text-primary'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <StudioDetailTabIcon name={tab.id} />
                <PoiTabTriggerLabel label={tab.label} />
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </>
  );
}

const renderPoiTabPanel = ({
  title,
  description,
  panel,
}: Readonly<{
  title: string;
  description: string;
  panel: React.JSX.Element;
}>) => (
  <div className="space-y-4 rounded-2xl border border-border/60 bg-[rgb(var(--waste-panel-surface))] p-5">
    <section
      aria-label={title}
      className="flex flex-col gap-3 border-0 bg-transparent p-0 lg:flex-row lg:items-start lg:justify-between"
    >
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </section>
    {panel}
  </div>
);

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
    warmTab,
    visitedTabs,
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
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => handleTabChange(value as PoiDetailTabId)}
      className="space-y-0"
    >
      <PoiDetailTabNavigation
        activeTab={activeTab}
        tabs={tabs}
        pt={pt}
        handleTabChange={handleTabChange}
        warmTab={warmTab}
      />
      {tabs.map((tab) => {
        const shouldKeepMounted = visitedTabs.includes(tab.id) && tab.id !== activeTab;

        return (
          <TabsContent
            key={tab.id}
            value={tab.id}
            forceMount={shouldKeepMounted || undefined}
            className="mt-0 data-[state=inactive]:hidden"
          >
            {renderPoiTabPanel({
              title: tab.title,
              description: tab.description,
              panel: tabPanels[tab.id],
            })}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
