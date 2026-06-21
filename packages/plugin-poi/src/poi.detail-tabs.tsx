export type PoiDetailTabId =
  | 'basis'
  | 'location'
  | 'description'
  | 'contact'
  | 'openingHours'
  | 'links'
  | 'operator'
  | 'prices'
  | 'media'
  | 'advanced'
  | 'history';

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
    id: 'location',
    label: pt('detailTabs.location.title'),
    title: pt('detailTabs.location.title'),
    description: pt('detailTabs.location.description'),
  },
  {
    id: 'description',
    label: pt('detailTabs.description.title'),
    title: pt('detailTabs.description.title'),
    description: pt('detailTabs.description.description'),
  },
  {
    id: 'contact',
    label: pt('detailTabs.contact.title'),
    title: pt('detailTabs.contact.title'),
    description: pt('detailTabs.contact.description'),
  },
  {
    id: 'openingHours',
    label: pt('detailTabs.openingHours.title'),
    title: pt('detailTabs.openingHours.title'),
    description: pt('detailTabs.openingHours.description'),
  },
  {
    id: 'links',
    label: pt('detailTabs.links.title'),
    title: pt('detailTabs.links.title'),
    description: pt('detailTabs.links.description'),
  },
  {
    id: 'operator',
    label: pt('detailTabs.operator.title'),
    title: pt('detailTabs.operator.title'),
    description: pt('detailTabs.operator.description'),
  },
  {
    id: 'prices',
    label: pt('detailTabs.prices.title'),
    title: pt('detailTabs.prices.title'),
    description: pt('detailTabs.prices.description'),
  },
  {
    id: 'media',
    label: pt('detailTabs.media.title'),
    title: pt('detailTabs.media.title'),
    description: pt('detailTabs.media.description'),
  },
  {
    id: 'advanced',
    label: pt('detailTabs.advanced.title'),
    title: pt('detailTabs.advanced.title'),
    description: pt('detailTabs.advanced.description'),
  },
  {
    id: 'history',
    label: pt('detailTabs.history.title'),
    title: pt('detailTabs.history.title'),
    description: pt('detailTabs.history.description'),
  },
];
