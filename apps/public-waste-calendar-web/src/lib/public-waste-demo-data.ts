import type { PublicWasteCalendarEntry } from './public-waste-contract.js';

export const demoRegions = [{ id: 'r-1', label: 'Musterregion' }] as const;
export const demoCities = [
  { id: 'c-1', label: 'Musterstadt', regionId: 'r-1' },
  { id: 'c-2', label: 'Nebenort', regionId: 'r-1' },
] as const;
export const demoStreets = [
  { id: 's-1', label: 'Hauptstraße', cityId: 'c-1' },
  { id: 's-2', label: 'Bahnhofstraße', cityId: 'c-1' },
  { id: 's-3', label: 'Dorfplatz', cityId: 'c-2' },
] as const;
export const demoHouseNumbers = [
  { id: 'h-12', label: '12', streetId: 's-1' },
  { id: 'h-14', label: '14', streetId: 's-1' },
  { id: 'h-1', label: '1', streetId: 's-2' },
  { id: 'h-3', label: '3', streetId: 's-3' },
] as const;

export const demoCalendarEntriesByLocationKey: Record<string, readonly PublicWasteCalendarEntry[]> = {
  'r-1:c-1:s-1:h-12': [
    {
      id: 'pickup-1',
      date: '2026-05-19',
      fractionId: 'bio',
      fractionLabel: 'Bioabfall',
      note: 'Bitte Tonne ab 6 Uhr bereitstellen.',
    },
    {
      id: 'pickup-2',
      date: '2026-05-26',
      fractionId: 'paper',
      fractionLabel: 'Papier',
      note: null,
    },
  ],
  'r-1:c-1:s-1:h-14': [
    {
      id: 'pickup-3',
      date: '2026-05-20',
      fractionId: 'bio',
      fractionLabel: 'Bioabfall',
      note: null,
    },
  ],
  'r-1:c-1:s-2:h-1': [
    {
      id: 'pickup-4',
      date: '2026-05-21',
      fractionId: 'residual',
      fractionLabel: 'Restabfall',
      note: null,
    },
  ],
  'r-1:c-2:s-3:h-3': [
    {
      id: 'pickup-5',
      date: '2026-05-22',
      fractionId: 'glass',
      fractionLabel: 'Glas',
      note: null,
    },
  ],
};
