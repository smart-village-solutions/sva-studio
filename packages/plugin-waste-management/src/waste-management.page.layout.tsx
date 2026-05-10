import type { ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle, Badge, Input, Select, StudioEmptyState, Tabs, TabsContent, TabsList, TabsTrigger } from '@sva/studio-ui-react';

import { WasteMasterDataPanel } from './waste-management.master-data-panel.js';
import { WasteOverviewPanel } from './waste-management.overview-panel.js';
import { WasteSchedulingPanel } from './waste-management.scheduling-panel.js';
import { WasteSettingsPanel } from './waste-management.settings-panel.js';
import { WasteToolsPanel } from './waste-management.tools-panel.js';
import { WasteToursPanel } from './waste-management.tours-panel.js';
import { type WasteManagementSearchParams, type WasteManagementTabId, wasteManagementTabIds } from './search-params.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const wasteManagementTabTranslationKeyMap = {
  overview: 'overview',
  'master-data': 'masterData',
  tours: 'tours',
  scheduling: 'scheduling',
  tools: 'tools',
  settings: 'settings',
} as const satisfies Record<WasteManagementTabId, string>;

export const WasteManagementPageToolbar = ({
  pt,
  search,
  onSearchChange,
  onStatusChange,
  onShiftContextChange,
}: {
  readonly pt: Translate;
  readonly search: WasteManagementSearchParams;
  readonly onSearchChange: (value: string) => void;
  readonly onStatusChange: (value: WasteManagementSearchParams['status']) => void;
  readonly onShiftContextChange: (value: WasteManagementSearchParams['shiftContext']) => void;
}) => (
  <div className="flex flex-col gap-3 md:flex-row md:items-center">
    <Input
      aria-label={pt('filters.searchLabel')}
      value={search.q}
      onChange={(event) => onSearchChange(event.target.value)}
      placeholder={pt('filters.searchPlaceholder')}
    />
    <Select
      aria-label={pt('filters.statusLabel')}
      value={search.status}
      onChange={(event) => onStatusChange(event.target.value as WasteManagementSearchParams['status'])}
    >
      <option value="all">{pt('filters.status.all')}</option>
      <option value="active">{pt('filters.status.active')}</option>
      <option value="inactive">{pt('filters.status.inactive')}</option>
    </Select>
    <Select
      aria-label={pt('filters.shiftContextLabel')}
      value={search.shiftContext}
      onChange={(event) => onShiftContextChange(event.target.value as WasteManagementSearchParams['shiftContext'])}
    >
      <option value="all">{pt('filters.shiftContext.all')}</option>
      <option value="global">{pt('filters.shiftContext.global')}</option>
      <option value="tour">{pt('filters.shiftContext.tour')}</option>
    </Select>
  </div>
);

const tabContentMap = (
  search: WasteManagementSearchParams
): Record<WasteManagementTabId, ReactNode> => ({
  overview: <WasteOverviewPanel search={search} />,
  'master-data': <WasteMasterDataPanel search={search} />,
  tours: <WasteToursPanel search={search} />,
  scheduling: <WasteSchedulingPanel search={search} />,
  settings: <WasteSettingsPanel />,
  tools: <WasteToolsPanel />,
});

export const WasteManagementPageTabs = ({
  pt,
  search,
  onTabChange,
}: {
  readonly pt: Translate;
  readonly search: WasteManagementSearchParams;
  readonly onTabChange: (value: WasteManagementTabId) => void;
}) => {
  const activeTabKey = wasteManagementTabTranslationKeyMap[search.tab];
  const content = tabContentMap(search);

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>{pt(`tabs.${activeTabKey}.title`)}</AlertTitle>
        <AlertDescription>{pt(`tabs.${activeTabKey}.body`)}</AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Badge>{pt(`tabs.${activeTabKey}.title`)}</Badge>
        <Badge variant="outline">{pt('meta.page', { page: search.page })}</Badge>
        <Badge variant="outline">{pt('meta.pageSize', { pageSize: search.pageSize })}</Badge>
        {search.q ? <Badge variant="secondary">{pt('meta.search', { value: search.q })}</Badge> : null}
      </div>

      <Tabs value={search.tab} onValueChange={(value) => onTabChange(value as WasteManagementTabId)} className="space-y-4">
        <TabsList aria-label={pt('tabs.ariaLabel')}>
          {wasteManagementTabIds.map((tabId) => {
            const tabKey = wasteManagementTabTranslationKeyMap[tabId];
            return (
              <TabsTrigger key={tabId} value={tabId}>
                {pt(`tabs.${tabKey}.title`)}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {wasteManagementTabIds.map((tabId) => {
          const tabKey = wasteManagementTabTranslationKeyMap[tabId];
          return (
            <TabsContent key={tabId} value={tabId}>
              {content[tabId] ?? (
                <StudioEmptyState>
                  <div className="space-y-2 text-left">
                    <p className="font-medium">{pt(`tabs.${tabKey}.emptyTitle`)}</p>
                    <p>{pt(`tabs.${tabKey}.emptyBody`)}</p>
                  </div>
                </StudioEmptyState>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
};
