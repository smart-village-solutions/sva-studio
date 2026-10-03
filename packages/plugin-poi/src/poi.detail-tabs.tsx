import React from 'react';

export type PoiDetailTabId = 'basis' | 'content' | 'settings' | 'history';

export type PoiDetailTabDefinition = Readonly<{
  id: PoiDetailTabId;
  label: string;
  title: string;
  description: string;
}>;

export const createPoiDetailTabDefinitions = (
  pt: (key: string) => string
): readonly PoiDetailTabDefinition[] => [
  {
    id: 'basis',
    label: pt('detailTabs.basis.title'),
    title: pt('detailTabs.basis.title'),
    description: pt('detailTabs.basis.description'),
  },
  {
    id: 'content',
    label: pt('detailTabs.content.title'),
    title: pt('detailTabs.content.title'),
    description: pt('detailTabs.content.description'),
  },
  {
    id: 'settings',
    label: pt('detailTabs.settings.title'),
    title: pt('detailTabs.settings.title'),
    description: pt('detailTabs.settings.description'),
  },
  {
    id: 'history',
    label: pt('detailTabs.history.title'),
    title: pt('detailTabs.history.title'),
    description: pt('detailTabs.history.description'),
  },
];

export const usePoiDetailTabState = () => {
  const [activeTab, setActiveTab] = React.useState<PoiDetailTabId>('basis');
  const [visitedTabs, setVisitedTabs] = React.useState<readonly PoiDetailTabId[]>(['basis']);
  const handleTabChange = React.useCallback((tabId: PoiDetailTabId) => {
    setActiveTab((current) => (current === tabId ? current : tabId));
  }, []);
  const warmTab = React.useCallback((tabId: PoiDetailTabId) => {
    setVisitedTabs((current) => (current.includes(tabId) ? current : [...current, tabId]));
  }, []);
  React.useEffect(() => {
    setVisitedTabs((current) => (current.includes(activeTab) ? current : [...current, activeTab]));
  }, [activeTab]);
  return { activeTab, setActiveTab, visitedTabs, handleTabChange, warmTab };
};
