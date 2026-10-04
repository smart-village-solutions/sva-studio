import * as React from 'react';
import type { FieldNamesMarkedBoolean, FormState } from 'react-hook-form';
import { deriveDirtyNewsDetailTabs } from './news.detail-form.js';
import type { NewsDetailFormValues } from './news.types.js';
import { Select, Tabs, TabsContent, TabsList, TabsTrigger } from '@sva/studio-ui-react';
import { createNewsDetailTabDefinitions, newsTabIconMap } from './news.detail-tabs.js';
import type { PluginTranslator } from './news.detail-page.helpers.js';
import type { NewsDetailTabId } from './news.types.js';

export const NewsDetailTabs = ({
  tabs,
  activeTab,
  handleTabChange,
  warmTab,
  visitedTabs,
  pt,
}: Readonly<{
  tabs: ReturnType<typeof createNewsDetailTabDefinitions>;
  activeTab: NewsDetailTabId;
  handleTabChange: (tab: NewsDetailTabId) => void;
  warmTab: (tab: NewsDetailTabId) => void;
  visitedTabs: readonly NewsDetailTabId[];
  pt: PluginTranslator;
}>) => (
  <Tabs
    value={activeTab}
    onValueChange={(value) => handleTabChange(value as NewsDetailTabId)}
    className="space-y-0"
  >
    <label className="block md:hidden">
      <span className="sr-only">{pt('tabs.mobileLabel')}</span>
      <Select
        aria-label={pt('tabs.mobileLabel')}
        className="h-11 rounded-xl border-border/70 bg-card"
        value={activeTab}
        onChange={(event) => handleTabChange(event.target.value as NewsDetailTabId)}
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
        const TabIcon = newsTabIconMap[tab.id];
        const isActive = tab.id === activeTab;

        return (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
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
              {tab.hasChanges && tab.changeLabel ? (
                <span className="text-xs font-medium text-foreground">{tab.changeLabel}</span>
              ) : null}
            </span>
          </TabsTrigger>
        );
      })}
    </TabsList>
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
            <section
              aria-label={tab.title ? String(tab.title) : tab.label}
              className="flex flex-col gap-3 border-0 bg-transparent p-0 lg:flex-row lg:items-start lg:justify-between"
            >
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground">
                  {tab.title ?? tab.label}
                </h2>
                {tab.description ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">{tab.description}</p>
                ) : null}
              </div>
              {tab.actions ? (
                <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
                  {tab.actions}
                </div>
              ) : null}
            </section>
            {tab.panel}
          </div>
        </TabsContent>
      );
    })}
  </Tabs>
);

const isDirtyFieldTree = (
  value: FieldNamesMarkedBoolean<NewsDetailFormValues> | undefined
): value is FieldNamesMarkedBoolean<NewsDetailFormValues> => Boolean(value);

export const useNewsDirtyTabs = (formState: FormState<NewsDetailFormValues>) => {
  return React.useMemo(
    () =>
      formState.isDirty
        ? deriveDirtyNewsDetailTabs(
            (isDirtyFieldTree(formState.dirtyFields) ? formState.dirtyFields : {}) as Parameters<
              typeof deriveDirtyNewsDetailTabs
            >[0]
          )
        : {
            basis: false,
            content: false,
            settings: false,
            history: false,
          },
    [formState.dirtyFields, formState.isDirty]
  );
};

export const useNewsDetailTabsState = () => {
  const [activeTab, setActiveTab] = React.useState<NewsDetailTabId>('basis');
  const [visitedTabs, setVisitedTabs] = React.useState<readonly NewsDetailTabId[]>(['basis']);
  React.useEffect(() => {
    setVisitedTabs((current) => (current.includes(activeTab) ? current : [...current, activeTab]));
  }, [activeTab]);

  const warmTab = React.useCallback((tabId: NewsDetailTabId) => {
    setVisitedTabs((current) => (current.includes(tabId) ? current : [...current, tabId]));
  }, []);

  const handleTabChange = React.useCallback(
    (nextTab: NewsDetailTabId) => {
      if (nextTab === activeTab) {
        return;
      }
      setActiveTab(nextTab);
    },
    [activeTab]
  );

  return { activeTab, handleTabChange, warmTab, visitedTabs };
};
