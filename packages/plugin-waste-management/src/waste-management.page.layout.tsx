import { StudioDetailTabs } from '@sva/studio-ui-react';

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
  wasteManagementTabIconMap,
  wasteManagementTabTranslationKeyMap,
} from './waste-management.page.layout.parts.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

const defaultUiAccess = deriveWasteManagementUiAccess([
  'waste-management.settings.manage',
  'waste-management.import.execute',
  'waste-management.export.execute',
  'waste-management.seed.execute',
  'waste-management.reset.execute',
]);

export const WasteManagementPageTabs = ({
  pt,
  search,
  rawSearch = search,
  access = defaultUiAccess,
  visibleTabIds = wasteManagementTabIds,
  assignmentContextKey = null,
  onTabChange,
  onAddressSearchChange,
}: {
  readonly pt: Translate;
  readonly search: WasteManagementSearchParams;
  readonly rawSearch?: Readonly<Record<string, unknown>>;
  readonly access?: WasteManagementUiAccess;
  readonly visibleTabIds?: readonly WasteManagementTabId[];
  readonly assignmentContextKey?: string | null;
  readonly onTabChange: (value: WasteManagementTabId) => void;
  readonly onAddressSearchChange: (patch: Partial<WasteManagementSearchParams>) => void;
}) => {
  const content = createWasteManagementTabContentMap(
    search,
    access,
    onAddressSearchChange,
    rawSearch,
    assignmentContextKey
  );
  if (search.tab === 'tours' && search.toursView === 'assignments') {
    return content.tours;
  }
  const activeTab = visibleTabIds.includes(search.tab)
    ? search.tab
    : (visibleTabIds[0] ?? search.tab);
  return (
    <StudioDetailTabs<WasteManagementTabId>
      ariaLabel={pt('tabs.ariaLabel')}
      value={activeTab}
      onValueChange={onTabChange}
      keepMounted
      preloadOnIntent
      tabs={visibleTabIds.map((tabId) => ({
        id: tabId,
        label: pt(`tabs.${wasteManagementTabTranslationKeyMap[tabId]}.title`),
        title: null,
        icon: wasteManagementTabIconMap[tabId],
        panel: <WasteManagementTabContent pt={pt} tabId={tabId} content={content} />,
      }))}
    />
  );
};
