import { useCallback, useEffect, useState } from 'react';
import { Tabs } from '@sva/studio-ui-react';

import {
  type WasteManagementSearchParams,
  type WasteManagementTabId,
  wasteManagementTabIds,
} from './search-params.js';
import {
  deriveWasteManagementUiAccess,
  type WasteManagementUiAccess,
} from './waste-management.ui-access.js';
import {
  createWasteManagementTabContentMap,
  WasteManagementTabContent,
  WasteManagementTabsList,
} from './waste-management.page.layout.parts.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

const defaultUiAccess = deriveWasteManagementUiAccess([
  'waste-management.settings.manage',
  'waste-management.import.execute',
  'waste-management.seed.execute',
  'waste-management.reset.execute',
]);

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
  const content = createWasteManagementTabContentMap(search, access);
  const activeTab = visibleTabIds.includes(search.tab)
    ? search.tab
    : (visibleTabIds[0] ?? search.tab);
  const [visitedTabIds, setVisitedTabIds] = useState<readonly WasteManagementTabId[]>([activeTab]);

  useEffect(() => {
    setVisitedTabIds((current) =>
      current.includes(activeTab) ? current : [...current, activeTab]
    );
  }, [activeTab]);

  const warmTab = useCallback((tabId: WasteManagementTabId) => {
    setVisitedTabIds((current) => (current.includes(tabId) ? current : [...current, tabId]));
  }, []);

  return (
    <div className="space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange(value as WasteManagementTabId)}
        className="space-y-0"
      >
        <WasteManagementTabsList
          pt={pt}
          activeTab={activeTab}
          visibleTabIds={visibleTabIds}
          onWarmTab={warmTab}
          onTabChange={onTabChange}
        />
        {visibleTabIds.map((tabId) => (
          <WasteManagementTabContent
            key={tabId}
            pt={pt}
            tabId={tabId}
            activeTab={activeTab}
            visitedTabIds={visitedTabIds}
            content={content}
          />
        ))}
      </Tabs>
    </div>
  );
};
