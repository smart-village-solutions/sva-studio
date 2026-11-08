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
