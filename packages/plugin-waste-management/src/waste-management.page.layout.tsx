import { useEffect, useState, type ReactNode } from 'react';
import {
  IconCalendarClock,
  IconDatabase,
  IconMapPin,
  IconRecycle,
  IconRoute,
  IconSettings,
} from '@tabler/icons-react';

import { StudioEmptyState, Tabs, TabsContent, TabsList, TabsTrigger } from '@sva/studio-ui-react';

import { WasteMasterDataPanel } from './waste-management.master-data-panel.js';
import { WasteOverviewPanel } from './waste-management.overview-panel.js';
import { WasteSchedulingPanel } from './waste-management.scheduling-panel.js';
import { WasteSettingsPanel } from './waste-management.settings-panel.js';
import { WasteTabPanelActionsProvider } from './waste-management.tab-panel-actions.js';
import { WasteToolsPanel } from './waste-management.tools-panel.js';
import { WasteToursPanel } from './waste-management.tours-panel.js';
import { type WasteManagementSearchParams, type WasteManagementTabId, wasteManagementTabIds } from './search-params.js';
import { deriveWasteManagementUiAccess, type WasteManagementUiAccess } from './waste-management.ui-access.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const wasteManagementTabTranslationKeyMap = {
  fractions: 'fractions',
  tours: 'tours',
  locations: 'locations',
  scheduling: 'scheduling',
  tools: 'tools',
  settings: 'settings',
} as const satisfies Record<WasteManagementTabId, string>;

const wasteManagementTabIconMap = {
  fractions: IconRecycle,
  tours: IconRoute,
  locations: IconMapPin,
  scheduling: IconCalendarClock,
  tools: IconDatabase,
  settings: IconSettings,
} as const satisfies Record<WasteManagementTabId, typeof IconRecycle>;

const defaultUiAccess = deriveWasteManagementUiAccess([
  'waste-management.settings.manage',
  'waste-management.import.execute',
  'waste-management.seed.execute',
  'waste-management.reset.execute',
]);

const tabContentMap = (
  search: WasteManagementSearchParams,
  access: WasteManagementUiAccess
): Record<WasteManagementTabId, ReactNode> => ({
  fractions: <WasteMasterDataPanel search={search} tab="fractions" />,
  tours: <WasteToursPanel search={search} />,
  locations: <WasteMasterDataPanel search={search} tab="locations" />,
  scheduling: <WasteSchedulingPanel search={search} />,
  settings: <WasteSettingsPanel />,
  tools: <WasteToolsPanel search={search} access={access} overview={<WasteOverviewPanel search={search} />} />,
});

export const WasteManagementPageTabs = ({
  pt,
  search,
  access = defaultUiAccess,
  visibleTabIds = wasteManagementTabIds,
  onTabChange,
}: {
  readonly pt: Translate;
  readonly search: WasteManagementSearchParams;
  readonly access?: WasteManagementUiAccess;
  readonly visibleTabIds?: readonly WasteManagementTabId[];
  readonly onTabChange: (value: WasteManagementTabId) => void;
}) => {
  const content = tabContentMap(search, access);
  const activeTab = visibleTabIds.includes(search.tab) ? search.tab : visibleTabIds[0] ?? search.tab;
  const [visitedTabIds, setVisitedTabIds] = useState<readonly WasteManagementTabId[]>([activeTab]);

  useEffect(() => {
    setVisitedTabIds((current) => (current.includes(activeTab) ? current : [...current, activeTab]));
  }, [activeTab]);

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as WasteManagementTabId)} className="space-y-0">
        <TabsList aria-label={pt('tabs.ariaLabel')} className="ml-[10px] gap-10">
          {visibleTabIds.map((tabId) => {
            const tabKey = wasteManagementTabTranslationKeyMap[tabId];
            const TabIcon = wasteManagementTabIconMap[tabId];
            const isActive = tabId === activeTab;
            return (
              <TabsTrigger
                key={tabId}
                value={tabId}
                className={`relative z-10 gap-2 rounded-none border-x-0 border-t-0 border-b-[3px] px-0 pr-5 shadow-none ${
                  isActive ? 'mb-[-1px] border-primary text-primary' : 'border-transparent text-muted-foreground'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <TabIcon aria-hidden="true" className="h-4 w-4 shrink-0" stroke={1.8} data-icon-library="tabler" />
                  <span>{pt(`tabs.${tabKey}.title`)}</span>
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {visibleTabIds.map((tabId) => {
          const tabKey = wasteManagementTabTranslationKeyMap[tabId];
          const shouldKeepMounted = visitedTabIds.includes(tabId) && tabId !== activeTab;
          return (
            <TabsContent key={tabId} value={tabId} forceMount={shouldKeepMounted || undefined} className="mt-0">
              <WasteTabPanelActionsProvider
                render={(actions) => (
                  <div className="space-y-4 rounded-2xl border border-border/60 bg-[#E8E8D8] p-5">
                    <section
                      aria-label={pt(`tabs.${tabKey}.title`)}
                      className="flex flex-col gap-3 border-0 bg-transparent p-0 lg:flex-row lg:items-start lg:justify-between"
                    >
                      <div className="space-y-1">
                        <h2 className="text-base font-semibold text-foreground">{pt(`tabs.${tabKey}.title`)}</h2>
                        <p className="text-sm leading-relaxed text-muted-foreground">{pt(`tabs.${tabKey}.body`)}</p>
                      </div>
                      {actions ? <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">{actions}</div> : null}
                    </section>
                    {content[tabId] ?? (
                      <StudioEmptyState>
                        <div className="space-y-2 text-left">
                          <p className="font-medium">{pt(`tabs.${tabKey}.emptyTitle`)}</p>
                          <p>{pt(`tabs.${tabKey}.emptyBody`)}</p>
                        </div>
                      </StudioEmptyState>
                    )}
                  </div>
                )}
              >
                <></>
              </WasteTabPanelActionsProvider>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
};
